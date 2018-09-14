const LibYUtils = require('./youtube_utils');

module.exports = {
    async getAsset(vidId, type) {
        const videoInfo = await LibYUtils.getVideoPageData(vidId);

        if (type === 'audio') {
            let videos = LibYUtils.parseVideosMap(videoInfo.adaptive_fmts);
            videos = await LibYUtils.decryptVideos(videos, videoInfo.playerPath);
            return videos.find(video => video.type.startsWith('audio/mp4'))
        }

        if (type === 'video') {
            let videos = LibYUtils.parseVideosMap(videoInfo.url_encoded_fmt_stream_map);
            videos = await LibYUtils.decryptVideos(videos, videoInfo.playerPath);
            return videos.find(video => video.type.startsWith('video/mp4'))
        }
    }
};
