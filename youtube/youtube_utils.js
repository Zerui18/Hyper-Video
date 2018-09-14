const LibYDecipher = require('./youtube_decipher_optimized');
const LibURL = require('url');
const rq = require('request-promise-native')
    .defaults({headers: {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.1 Safari/605.1.15'}});


module.exports = {

    // get streamMaps and actionList from vidId
    async getVideoPageData(vidId) {
        const html = await rq(`https://m.youtube.com/watch?v=${vidId}`);
        const playerConfigJSON = /.config = ({.+?});ytplayer.load/g.exec(html)[1];
        if (!playerConfigJSON) throw new Error('Video not found.');
        else {
            const playerConfig = JSON.parse(playerConfigJSON);
            return {
                url_encoded_fmt_stream_map: playerConfig.args.url_encoded_fmt_stream_map,
                adaptive_fmts: playerConfig.args.adaptive_fmts,
                playerPath: playerConfig.assets.js
            }
        }
    },

    // parse url-encoded
    parseVideosMap(encodedStreamMap) {
        let sources = encodedStreamMap.split(',');
        return sources.map((s) => {
            return LibURL.parse('http://dummy.com?' + s, true).query
        })
    },

    // dict of playerURL to actionList
    playerToActions: {},

    // get acionsList: Array from playerPath
    async getActions(playerPath) {
        if (this.playerToActions[playerPath]) return this.playerToActions[playerPath];
        else {
            const source = await rq(`https://www.youtube.com${playerPath}`);
            const actions = LibYDecipher.getActList(source);
            this.playerToActions[playerPath] = actions;
            return actions
        }
    },

    decryptVideos(videos, playerPath) {
        let actList;
        return Promise.all(videos.map(async (video) => {
            if (!video.s) return video;
            if (!actList) {
                actList = await this.getActions(playerPath);
            }
            video.url = video.url.replace(/&?signature=[^&]+/g, '');
            video.url += '&signature=' + LibYDecipher.applyActions(actList, video.s);
            return video
        }))
    }

};
