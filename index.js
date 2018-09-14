const LibYoutubeInfo = require('./youtube/youtube_info');
const LibYoutubeVideo = require('./youtube/youtube_video');
const LibUtils = require('./utils');
const LibASK = require('ask-sdk-core');

// Constants
const APP_ID = undefined;
const welcomeOutput = 'Welcome to Youtube. You can ask me to search for videos and channels.';

// Customized Handlers
const LaunchRequestHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'LaunchRequest'
    },

    handle(handlerInput) {
        const responseBuilder = handlerInput.responseBuilder;
        return responseBuilder
            .speak(welcomeOutput)
            .reprompt('')
            .getResponse()
    }
};

async function fetchSearchResult(keywords, maxResults, params) {
    params = params || {};
    params.type = 'video';
    const rawResult = await LibYoutubeInfo.search(keywords, maxResults, params);
    const result = JSON.parse(rawResult);
    return LibUtils.trimSearchResult(result)
}

// update gui display (if available) & session attributes
function updateSearchResult(handlerInput, keywords, result) {
    const attributesManager = handlerInput.attributesManager;
    const responseBuilder = handlerInput.responseBuilder;

    if (LibUtils.supportsDisplay(handlerInput)) {
        const template = LibUtils.listTemplateFromSearchResult(result);
        responseBuilder.addRenderTemplateDirective(template)
    }

    const newAttrs = {
        'keywords': keywords,
        'result': result,
        'index': 0
    };
    attributesManager.setSessionAttributes(newAttrs)
}

async function fetchAndUpdateSearchResult(handlerInput, keywords, maxResults, params) {
    const result = await fetchSearchResult(keywords, maxResults, params);
    updateSearchResult(handlerInput, keywords, result);
    return result
}

async function fetchAndPlayItem(handlerInput, item, format = 'video', mode = 'REPLACE_ALL') {
    const responseBuilder = handlerInput.responseBuilder;
    const sessionAttrs = handlerInput.attributesManager.getSessionAttributes();
    if (format === 'video' && LibUtils.supportsDisplay(handlerInput)) {
        // play video
        /** @namespace video.id.videoId */
        const video = await LibYoutubeVideo.getAsset(item.id.videoId, 'video');
        responseBuilder.addVideoAppLaunchDirective(video.url + '&.mp4', item.title, `From ${item.channelTitle}`);
        responseBuilder.speak('Video started');
    }
    else {
        // play audio / enqueue audio track
        const video = await LibYoutubeVideo.getAsset(item.id.videoId, 'audio');
        responseBuilder.addAudioPlayerPlayDirective(mode, video.url + '&.mp4', video.url + '&.mp4', 0);
        responseBuilder.speak('Audio started');
        sessionAttrs.hasEnqueuedAudio = mode !== 'REPLACE_ALL';
    }
    sessionAttrs.currentVideoId = item.id;
    handlerInput.attributesManager.setSessionAttributes(sessionAttrs)
}

// intent for new search
const SearchRequestHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        /** @namespace request.intent */
        return request.intent.name === 'SearchIntent'
    },

    async handle(handlerInput) {
        const responseBuilder = handlerInput.responseBuilder;
        try {
            const slots = LibUtils.getSlots(handlerInput);
            const keywords = slots.keywords.value;

            const result = await fetchAndUpdateSearchResult(handlerInput, keywords, 10);

            // read title text, as well as the first item
            /** @namespace result.pageInfo.totalResults */
            let speech = `Found ${result.pageInfo.totalResults} results for <break strength='medium'/>${keywords}<break strength='strong'/>`;
            speech += LibUtils.speechForItem(result.items[0], 0);
            responseBuilder.speak(speech)
                .reprompt('Do you want to play it?');
        }
        catch (err) {
            console.log(err);
            responseBuilder.speak('Search failed.');
        }
        return responseBuilder.getResponse()
    }
};

// intent for moving onto next search result (& fetching new page if necc.)
const NextIntentHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const attributesManager = handlerInput.attributesManager;
        /** @namespace request.intent */
        return request.intent.name === 'NextIntent' && attributesManager.getSessionAttributes()
    },

    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager;
        const responseBuilder = handlerInput.responseBuilder;

        try {
            const sessionAttrs = attributesManager.getSessionAttributes();
            if (sessionAttrs.index >= 9) {
                // fetch next page
                const params = {'pageToken': sessionAttrs.result.nextPageToken};
                const result = await fetchAndUpdateSearchResult(handlerInput, sessionAttrs.keywords, 10, params);
                responseBuilder.speak(LibUtils.speechForItem(result.items[0], 0))
                    .reprompt('Do you want to play it?')
            }
            else {
                // simply go to next cached result
                sessionAttrs.index++;
                const currIndex = sessionAttrs.index;
                attributesManager.setSessionAttributes(sessionAttrs);
                responseBuilder.speak(LibUtils.speechForItem(sessionAttrs.result.items[currIndex], currIndex))
                    .reprompt('Do you want to play it?')
            }
        }
        catch (err) {
            console.log('Error: NextIntent');
            console.dir(err);
            responseBuilder.speak('Cannot obtain the next item.')
        }
        return responseBuilder.getResponse()
    }
};

// intent for playing the currently selected video
const PlayIntentHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        /** @namespace request.intent */
        return request.intent.name === 'PlayIntent' || request.type === 'Display.ElementSelected'
    },

    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager;
        const responseBuilder = handlerInput.responseBuilder;
        try {
            const sessionAttrs = attributesManager.getSessionAttributes();
            /** @namespace handlerInput.requestEnvelope.request.intent */
            if (handlerInput.requestEnvelope.request.type === 'Display.ElementSelected') {
                const etag = handlerInput.requestEnvelope.request.token;
                sessionAttrs.index = sessionAttrs.result.items.findIndex((item) => item.etag === etag);
                attributesManager.setSessionAttributes(sessionAttrs)
            }
            const selectedItem = sessionAttrs.result.items[sessionAttrs.index];
            await fetchAndPlayItem(handlerInput, selectedItem);
        }
        catch (err) {
            console.log('Error: PlayIntent');
            console.dir(err);
            responseBuilder.speak('Failed to retrieve video.');
        }
        return responseBuilder.getResponse()
    }
};

const QuickPlayIntentHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        /** @namespace request.intent */
        return request.intent.name === 'QuickPlayIntent' ||
            request.intent.name === 'QuickPlayAudioIntent'
    },

    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager;
        const responseBuilder = handlerInput.responseBuilder;
        const request = handlerInput.requestEnvelope.request;
        /** @namespace request.intent */
        const slotName = request.intent.name === 'QuickPlayIntent' ? 'qpKeywords':'qpaKeywords';
        const qpKeywords = LibUtils.getSlots(handlerInput)[slotName].value;
        const format = slotName === 'QuickPlayIntent' ? 'video':'audio';

        try {
            const result = await fetchSearchResult(qpKeywords, 1);
            const item = result.items[0];
            attributesManager.setSessionAttributes({});
            await fetchAndPlayItem(handlerInput, item, format)
        }
        catch (err) {
            console.log('Error: QuickPlayIntent');
            console.dir(err);
            responseBuilder.speak(`Failed to retrieve ${format}.`)
        }
        return responseBuilder.getResponse()
    }
};

const AudioEndingHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'AudioPlayer.PlaybackNearlyFinished' || request.type === 'AudioPlayer.PlaybackFinished'
    },

    async handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        const attributesManager = handlerInput.attributesManager;
        const sessionAttrs = attributesManager.getSessionAttributes();
        if (sessionAttrs.hasEnqueuedAudio) return responseBuilder.getResponse();

        try {
            const related = await LibYoutubeInfo.related(sessionAttrs.currentVideoId, 1);
            const item = related[0];
            const playerVerb = request.type === 'AudioPlayer.PlaybackNearlyFinished' ? 'ENQUEUE':'REPLACE_ALL';
            await fetchAndPlayItem(handlerInput, item, 'audio', playerVerb);
        }
        catch (err) {
            console.log('Error: AudioEndingHandler');
            console.dir(err);
        }
        return responseBuilder.getResponse()
    }
};

const AudioNextHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        /** @namespace request.intent */
        return request.intent.name === 'AMAZON.NextIntent'
    },

    async handle(handlerInput) {
        const responseBuilder = handlerInput.responseBuilder;
        const attributesManager = handlerInput.attributesManager;
        const sessionAttrs = attributesManager.getSessionAttributes();
        try {
            const related = await LibYoutubeInfo.related(sessionAttrs.currentVideoId, 1);
            const item = related[0];
            await fetchAndPlayItem(handlerInput, item);
        }
        catch (err) {
            console.log('Error: AudioNextHandler');
            console.dir(err);
            responseBuilder.speak('Failed to get next item.')
        }
        return responseBuilder.getResponse()
    }
};

// Boring Handlers
const UnhandledHandler = {
    canHandle() {
        return true
    },
    handle(handlerInput) {
        console.log('Error: Unhandled');
        console.log(handlerInput.requestEnvelope.request);
        return handlerInput.responseBuilder
            .speak('Sorry, I don\'t know this command')
            .getResponse()
    },
};

const ErrorHandler = {
    canHandle() {
        return true
    },

    handle(handlerInput, error) {
        console.log(`Error handled: ${JSON.stringify(error)}`);
        console.log(`Handler Input: ${JSON.stringify(handlerInput)}`);

        return handlerInput.responseBuilder
            .speak('Something went wrong.')
            .reprompt('')
            .getResponse()
    }
};

const SessionEndedHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'SessionEndedRequest'
    },
    handle(handlerInput) {
        /** @namespace handlerInput.requestEnvelope.request.reason */
        console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);
        return handlerInput.responseBuilder.getResponse()
    },
};

// ASK Setup
const skillBuilder = LibASK.SkillBuilders.custom();
exports.handler = skillBuilder
    .addRequestHandlers(
        LaunchRequestHandler,
        SearchRequestHandler,
        NextIntentHandler,
        PlayIntentHandler,
        QuickPlayIntentHandler,
        AudioEndingHandler,
        AudioNextHandler,
        SessionEndedHandler,
        UnhandledHandler
    )
    .addErrorHandlers(ErrorHandler)
    .lambda();
