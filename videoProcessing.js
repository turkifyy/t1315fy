const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const {Storage} = require('@google-cloud/storage');
const storage = new Storage();
const spawn = require('child-process-promise').spawn;
const path = require('path');
const os = require('os');
const fs = require('fs-extra');
const ffmpegPath = require('ffmpeg-static');
const fluentFfmpeg = require('fluent-ffmpeg');
fluentFfmpeg.setFfmpegPath(ffmpegPath);

// 1. معالجة الفيديو عند التحميل
exports.processUploadedVideo = functions.storage
    .object()
    .onFinalize(async (object) => {
        const fileBucket = object.bucket;
        const filePath = object.name;
        const contentType = object.contentType;

        // التحقق من أن الملف هو فيديو
        if (!contentType.startsWith('video/')) {
            return console.log('هذا ليس ملف فيديو.');
        }

        // الحصول على اسم الملف ومجلده
        const fileDir = path.dirname(filePath);
        const fileName = path.basename(filePath);
        const videoId = fileName.split('.')[0];

        if (fileName.includes('_processed')) {
            return console.log('تم معالجة الفيديو مسبقًا.');
        }

        const tempLocalFile = path.join(os.tmpdir(), fileName);
        const tempLocalDir = path.dirname(tempLocalFile);

        // إنشاء مجلد مؤقت إذا لم يكن موجودًا
        await fs.ensureDir(tempLocalDir);

        // تنزيل الفيديو من Storage
        const bucket = storage.bucket(fileBucket);
        await bucket.file(filePath).download({destination: tempLocalFile});
        console.log('تم تنزيل الفيديو إلى:', tempLocalFile);

        // معالجة الفيديو باستخدام FFmpeg
        try {
            // أ. إنشاء نسخة متوافقة مع التشغيل
            const processedFileName = `${videoId}_processed.mp4`;
            const processedFilePath = path.join(os.tmpdir(), processedFileName);
            
            await new Promise((resolve, reject) => {
                fluentFfmpeg(tempLocalFile)
                    .videoCodec('libx264')
                    .audioCodec('aac')
                    .outputOptions([
                        '-movflags faststart',
                        '-profile:v main',
                        '-preset fast',
                        '-crf 28'
                    ])
                    .on('error', reject)
                    .on('end', resolve)
                    .save(processedFilePath);
            });

            // ب. إنشاء الثمبنييل
            const thumbnailFileName = `${videoId}_thumbnail.jpg`;
            const thumbnailFilePath = path.join(os.tmpdir(), thumbnailFileName);
            
            await new Promise((resolve, reject) => {
                fluentFfmpeg(tempLocalFile)
                    .screenshots({
                        timestamps: ['50%'],
                        filename: thumbnailFileName,
                        folder: os.tmpdir(),
                        size: '640x360'
                    })
                    .on('error', reject)
                    .on('end', resolve);
            });

            // ج. تحليل الفيديو للحصول على المدة والدقة
            const videoInfo = await getVideoInfo(tempLocalFile);

            // رفع الملفات المعالجة إلى Storage
            const processedFileUpload = bucket.upload(processedFilePath, {
                destination: `${fileDir}/${processedFileName}`,
                metadata: {
                    contentType: 'video/mp4'
                }
            });

            const thumbnailUpload = bucket.upload(thumbnailFilePath, {
                destination: `${fileDir}/${thumbnailFileName}`,
                metadata: {
                    contentType: 'image/jpeg'
                }
            });

            await Promise.all([processedFileUpload, thumbnailUpload]);
            console.log('تم رفع الفيديو والثمبنييل المعالجين');

            // تحديث معلومات الفيديو في Firestore
            const videoData = {
                processedUrl: `gs://${fileBucket}/${fileDir}/${processedFileName}`,
                thumbnailUrl: `gs://${fileBucket}/${fileDir}/${thumbnailFileName}`,
                duration: videoInfo.duration,
                resolution: videoInfo.resolution,
                status: 'processed',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            await admin.firestore().collection('videos').doc(videoId).update(videoData);
            console.log('تم تحديث بيانات الفيديو في Firestore');

            // حذف الملفات المؤقتة
            await fs.unlink(tempLocalFile);
            await fs.unlink(processedFilePath);
            await fs.unlink(thumbnailFilePath);

            return true;
        } catch (error) {
            console.error('حدث خطأ أثناء معالجة الفيديو:', error);
            
            // تحديث حالة الفيديو إلى فاشل
            await admin.firestore().collection('videos').doc(videoId).update({
                status: 'failed',
                error: error.message,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            return false;
        }
    });

// 2. دالة لتحليل معلومات الفيديو
async function getVideoInfo(filePath) {
    return new Promise((resolve, reject) => {
        fluentFfmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err);

            const duration = Math.round(metadata.format.duration);
            const videoStream = metadata.streams.find(s => s.codec_type === 'video');
            const resolution = {
                width: videoStream.width,
                height: videoStream.height
            };

            resolve({duration, resolution});
        });
    });
}

// 3. دالة لضغط الفيديو
exports.compressVideo = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated', 'يجب تسجيل الدخول لضغط الفيديوهات');
    }

    const {videoId, quality} = data;
    const validQualities = ['low', 'medium', 'high'];
    
    if (!validQualities.includes(quality)) {
        throw new functions.https.HttpsError(
            'invalid-argument', 'جودة الضغط غير صالحة');
    }

    try {
        // جلب معلومات الفيديو من Firestore
        const videoDoc = await admin.firestore().collection('videos').doc(videoId).get();
        if (!videoDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'الفيديو غير موجود');
        }

        const videoData = videoDoc.data();
        const filePath = videoData.processedUrl.replace('gs://', '');
        const [bucketName, ...fileParts] = filePath.split('/');
        const fileName = fileParts.join('/');
        
        // تنزيل الفيديو
        const tempLocalFile = path.join(os.tmpdir(), `compress_${videoId}.mp4`);
        await storage.bucket(bucketName).file(fileName).download({destination: tempLocalFile});

        // إعداد خيارات الضغط بناءً على الجودة
        let crf, preset;
        switch (quality) {
            case 'low': crf = 32; preset = 'ultrafast'; break;
            case 'medium': crf = 28; preset = 'fast'; break;
            case 'high': crf = 23; preset = 'medium'; break;
        }

        // ضغط الفيديو
        const compressedFileName = `${videoId}_${quality}_compressed.mp4`;
        const compressedFilePath = path.join(os.tmpdir(), compressedFileName);
        
        await new Promise((resolve, reject) => {
            fluentFfmpeg(tempLocalFile)
                .videoCodec('libx264')
                .audioCodec('aac')
                .outputOptions([
                    `-crf ${crf}`,
                    `-preset ${preset}`,
                    '-movflags faststart'
                ])
                .on('error', reject)
                .on('end', resolve)
                .save(compressedFilePath);
        });

        // رفع الفيديو المضغوط
        const compressedFileUrl = `${fileParts.slice(0, -1).join('/')}/${compressedFileName}`;
        await storage.bucket(bucketName).upload(compressedFilePath, {
            destination: compressedFileUrl,
            metadata: {contentType: 'video/mp4'}
        });

        // تحديث Firestore
        const updateData = {
            [`compressedUrls.${quality}`]: `gs://${bucketName}/${compressedFileUrl}`,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        await admin.firestore().collection('videos').doc(videoId).update(updateData);

        // تنظيف الملفات المؤقتة
        await fs.unlink(tempLocalFile);
        await fs.unlink(compressedFilePath);

        return {success: true, url: `gs://${bucketName}/${compressedFileUrl}`};
    } catch (error) {
        console.error('حدث خطأ أثناء ضغط الفيديو:', error);
        throw new functions.https.HttpsError('internal', 'فشل في ضغط الفيديو', error);
    }
});

// 4. دالة لاستخراج الصوت من الفيديو
exports.extractAudio = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated', 'يجب تسجيل الدخول لاستخراج الصوت');
    }

    const {videoId} = data;

    try {
        // جلب معلومات الفيديو
        const videoDoc = await admin.firestore().collection('videos').doc(videoId).get();
        if (!videoDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'الفيديو غير موجود');
        }

        const videoData = videoDoc.data();
        const filePath = videoData.processedUrl.replace('gs://', '');
        const [bucketName, ...fileParts] = filePath.split('/');
        const fileName = fileParts.join('/');
        
        // تنزيل الفيديو
        const tempLocalFile = path.join(os.tmpdir(), `audio_extract_${videoId}.mp4`);
        await storage.bucket(bucketName).file(fileName).download({destination: tempLocalFile});

        // استخراج الصوت
        const audioFileName = `${videoId}_audio.mp3`;
        const audioFilePath = path.join(os.tmpdir(), audioFileName);
        
        await new Promise((resolve, reject) => {
            fluentFfmpeg(tempLocalFile)
                .noVideo()
                .audioCodec('libmp3lame')
                .audioBitrate(128)
                .on('error', reject)
                .on('end', resolve)
                .save(audioFilePath);
        });

        // رفع ملف الصوت
        const audioFileUrl = `${fileParts.slice(0, -1).join('/')}/${audioFileName}`;
        await storage.bucket(bucketName).upload(audioFilePath, {
            destination: audioFileUrl,
            metadata: {contentType: 'audio/mpeg'}
        });

        // تحديث Firestore
        const updateData = {
            audioUrl: `gs://${bucketName}/${audioFileUrl}`,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        await admin.firestore().collection('videos').doc(videoId).update(updateData);

        // تنظيف الملفات المؤقتة
        await fs.unlink(tempLocalFile);
        await fs.unlink(audioFilePath);

        return {success: true, url: `gs://${bucketName}/${audioFileUrl}`};
    } catch (error) {
        console.error('حدث خطأ أثناء استخراج الصوت:', error);
        throw new functions.https.HttpsError('internal', 'فشل في استخراج الصوت', error);
    }
});

// 5. دالة لقص الفيديو
exports.trimVideo = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated', 'يجب تسجيل الدخول لقص الفيديوهات');
    }

    const {videoId, startTime, endTime} = data;

    try {
        // التحقق من صحة المدخلات
        if (startTime < 0 || endTime <= startTime) {
            throw new functions.https.HttpsError(
                'invalid-argument', 'أوقات البداية والنهاية غير صالحة');
        }

        // جلب معلومات الفيديو
        const videoDoc = await admin.firestore().collection('videos').doc(videoId).get();
        if (!videoDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'الفيديو غير موجود');
        }

        const videoData = videoDoc.data();
        const filePath = videoData.processedUrl.replace('gs://', '');
        const [bucketName, ...fileParts] = filePath.split('/');
        const fileName = fileParts.join('/');
        
        // تنزيل الفيديو
        const tempLocalFile = path.join(os.tmpdir(), `trim_${videoId}.mp4`);
        await storage.bucket(bucketName).file(fileName).download({destination: tempLocalFile});

        // قص الفيديو
        const trimmedFileName = `${videoId}_trimmed.mp4`;
        const trimmedFilePath = path.join(os.tmpdir(), trimmedFileName);
        
        await new Promise((resolve, reject) => {
            fluentFfmpeg(tempLocalFile)
                .setStartTime(startTime)
                .setDuration(endTime - startTime)
                .videoCodec('libx264')
                .audioCodec('aac')
                .on('error', reject)
                .on('end', resolve)
                .save(trimmedFilePath);
        });

        // رفع الفيديو المقصوص
        const trimmedFileUrl = `${fileParts.slice(0, -1).join('/')}/${trimmedFileName}`;
        await storage.bucket(bucketName).upload(trimmedFilePath, {
            destination: trimmedFileUrl,
            metadata: {contentType: 'video/mp4'}
        });

        // تحديث Firestore
        const updateData = {
            trimmedUrl: `gs://${bucketName}/${trimmedFileUrl}`,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        await admin.firestore().collection('videos').doc(videoId).update(updateData);

        // تنظيف الملفات المؤقتة
        await fs.unlink(tempLocalFile);
        await fs.unlink(trimmedFilePath);

        return {success: true, url: `gs://${bucketName}/${trimmedFileUrl}`};
    } catch (error) {
        console.error('حدث خطأ أثناء قص الفيديو:', error);
        throw new functions.https.HttpsError('internal', 'فشل في قص الفيديو', error);
    }
});