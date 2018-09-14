const youtubeUtils = require('./youtube_utils');

const videoId = 'mU_aL8V4FW8';

async function _getVideoPageData() {
    try {
        return await youtubeUtils.getVideoPageData(videoId)
    }
    catch(err) {
        console.log('Error: Get Video Page Data');
        console.dir(err);
        throw err
    }
}

function _parseVideosMap(encodedStreamMap) {
    try {
        return youtubeUtils.parseVideosMap(encodedStreamMap)
    }
    catch(err) {
        console.log('Error: Parse Video Map');
        console.dir(err);
        throw err
    }
}

async function _decryptVideos(videos, playerPath) {
    try {
        return await youtubeUtils.decryptVideos(videos, playerPath)
    }
    catch(err) {
        console.log('Error: Parse Video Map');
        console.dir(err);
        throw err
    }
}

async function testPipline() {
    const videoInfo = await _getVideoPageData();
    let videos = _parseVideosMap(videoInfo.adaptive_fmts);
    videos = await _decryptVideos(videos, videoInfo.playerPath);
    console.dir(videos);
    console.log('All Tests Passed!')
}

testPipline();