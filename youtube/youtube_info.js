const request = require('request-promise-native');
const queryString = require('querystring');

module.exports = {

    /**
     * API v3 Url
     * @type {string}
     */
    url: 'https://www.googleapis.com/youtube/v3/',

    /**
     * params
     * https://developers.google.com/youtube/v3/docs/search/list
     * @type {Object}
     */
    params: {'key': process.env['API_TOKEN'] || 'AIzaSyAwfUA_RZqGYJqQopPBa_ubctyeAgVz1uU'},

    parts: [],

    /**
     *
     * @param {string} name
     */
    addPart(name) {
        this.parts.push(name)
    },

    /**
     *
     * Optional parameters
     * https://developers.google.com/youtube/v3/docs/search/list
     *
     * @param {string} key
     * @param value
     */
    addParam(key, value) {
        this.params[key] = value
    },

    /**
     * Clear every parameter but the key
     */
    clearParams() {
        this.params = {
            key: this.params.key
        }
    },

    /**
     *
     * @param {string} path
     * @returns {string}
     */
    getUrl(path) {
        return this.url + path + '?' + queryString.stringify(this.params)
    },

    /**
     *
     * @returns {string}
     */
    getParts() {
        return this.parts.join(',')
    },

    /**
     * Return error object
     * @param {string} message
     */
    newError(message) {
        return {
            error: {
                message: message
            }
        }
    },

    /**
     * Validate params
     */
    validate() {
        if (!this.params.key) {
            return this.newError('Please set a key using setKey method. Get an key in https://console.developers.google.com')
        }
        else {
            return null
        }
    },

    /**
     * Initialize parts
     */
    clearParts() {
        this.parts = []
    },

    /**
     * Video data from ID
     * @param {string} id
     */
    getById(id) {
        const validate = this.validate();

        if (validate) {
            return validate
        }
        else {
            this.clearParams();
            this.clearParts();

            this.addPart('snippet');
            this.addPart('contentDetails');
            this.addPart('statistics');
            this.addPart('status');

            this.addParam('part', this.getParts());
            this.addParam('id', id);

            return request(this.getUrl('videos'))
        }
    },

    /**
     * Playlists data from Playlist Id
     * @param {string} id

     * https://developers.google.com/youtube/v3/docs/playlists/list
     */
    getPlayListsById(id) {
        const validate = this.validate();

        if (validate) {
            return validate
        }
        else {
            this.clearParams();
            this.clearParts();

            this.addPart('snippet');
            this.addPart('contentDetails');
            this.addPart('status');
            this.addPart('player');
            this.addPart('id');

            this.addParam('part', this.getParts());
            this.addParam('id', id);

            return request(this.getUrl('playlists'))
        }
    },

    /**
     * Playlists data from Playlist Id
     * @param {string} id
     * @param {int} maxResults
     * @param {string} id

     * https://developers.google.com/youtube/v3/docs/playlistItems/list
     */
    getPlayListsItemsById(id, maxResults) {

        const validate = this.validate();

        if (validate) {
            return validate
        }
        else {
            this.clearParams();
            this.clearParts();

            this.addPart('contentDetails');
            this.addPart('id');
            this.addPart('snippet');
            this.addPart('status');

            this.addParam('part', this.getParts());
            this.addParam('playlistId', id);

            this.addParam('maxResults', maxResults);

            return request(this.getUrl('playlistItems'))
        }
    },

    /**
     * Videos data from query
     * @param {string} query
     * @param {int} maxResults
     * @param params
     */
    search(query, maxResults, params) {

        const validate = this.validate();

        if (validate) {
            return validate
        }
        else {
            this.clearParams();
            this.clearParts();

            this.addPart('snippet');
            this.addParam('part', this.getParts());
            this.addParam('q', query);
            this.addParam('maxResults', maxResults);

            params && Object.keys(params).forEach((paramKey) => {
                if (params[paramKey]) {
                    this.addParam(paramKey, params[paramKey])
                }
            });

            return request(this.getUrl('search'))
        }
    },

    /**
     * Videos data from query
     * @param {string} id
     * @param {int} maxResults

     * Source: https://github.com/paulomcnally/youtube-node/pull/3/files
     */
    related(id, maxResults) {
        const validate = this.validate();

        if (validate) {
            return validate
        }
        else {
            this.clearParams();
            this.clearParts();

            this.addPart('snippet');

            this.addParam('part', this.getParts());
            this.addParam('relatedToVideoId', id);
            this.addParam('maxResults', maxResults);
            this.addParam('type', 'video');
            this.addParam('order', 'relevance');

            return request(this.getUrl('search'))
        }
    },

    /**
     * Videos data from most popular list
     * @param {int} maxResults
     * Source: https://github.com/paulomcnally/youtube-node/pull/3/files
     */
    getMostPopular(maxResults) {
        const validate = this.validate();

        if (validate) {
            return validate
        }
        else {
            this.clearParams();
            this.clearParts();

            this.addPart('snippet');

            this.addParam('part', this.getParts());
            this.addParam('maxResults', maxResults);
            this.addParam('chart', 'mostPopular');

            return request(this.getUrl('videos'))
        }
    },

    /**
     * Videos data from most popular list by videoCategoryId
     * @param {int} maxResults
     * Source: https://github.com/paulomcnally/youtube-node/pull/3/files
     * @param videoCategoryId
     */
    getMostPopularByCategory(maxResults, videoCategoryId) {
        const validate = this.validate();

        if (validate) {
            return validate
        }
        else {
            this.clearParams();
            this.clearParts();

            this.addPart('snippet');

            this.addParam('part', this.getParts());
            this.addParam('maxResults', maxResults);
            this.addParam('chart', 'mostPopular');
            this.addParam('videoCategoryId', videoCategoryId);

            return request(this.getUrl('videos'))
        }
    }
};
