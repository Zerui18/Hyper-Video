const LibASK = require('ask-sdk-core');

String.prototype.encodeHTML = function () {
  return this.replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;')
             .replace(/"/g, '&quot;')
             .replace(/'/g, '&apos;');
};

module.exports = {

  // Public Helper Functions

  supportsDisplay(handlerInput) {
    return handlerInput.requestEnvelope.context &&
    handlerInput.requestEnvelope.context.System &&
    handlerInput.requestEnvelope.context.System.device &&
    handlerInput.requestEnvelope.context.System.device.supportedInterfaces &&
    handlerInput.requestEnvelope.context.System.device.supportedInterfaces.Display
  },

  getSlots(handlerInput) {
    return handlerInput.requestEnvelope.request.intent.slots
  },

  // Helper Functions for SearchIntent
  listTemplateFromSearchResult(result) {
    return {
      type: `ListTemplate2`,
      token: result.etag,
      backButton: 'hidden',
      title: `${result.pageInfo.totalResults} Results`,
      listItems: this.listItemsFromSearchItems(result.items)
    }
  },

  listItemsFromSearchItems(items) {
    return items.map((item)=> {
      return {
        token: item.etag,
        textContent: new LibASK.RichTextContentHelper()
                                .withPrimaryText(`<font size='3'><b>${item.title.encodeHTML()}</b></font>`)
                                .withSecondaryText(item.channelTitle.encodeHTML()).getTextContent(),
        image: this.thumbnailForItem(item)
      }
    })
  },

  thumbnailForItem(item) {
    const imageObj = new LibASK.ImageHelper().withDescription(`thumbnail`);
    for(let res in item.thumbnails) {
      // noinspection JSUnfilteredForInLoop
        let image = item.thumbnails[res];
      imageObj.addImageInstance(image.url, null, image.width, image.height)
    }
    return imageObj.getImage()
  },

  trimSearchResult(result) {
    return {
      etag: result.etag,
      nextPageToken: result.nextPageToken,
      pageInfo: result.pageInfo,
      items: result.items.map((item)=> {
          /** @namespace item.snippet */
          return {
          etag: item.etag,
          id: item.id,
          title: item.snippet.title,
          thumbnails: item.snippet.thumbnails,
          channelTitle: item.snippet.channelTitle
        }
      })
    }
  },

  speechForItem(item, id) {
    return `${id+1}: <break strength='medium'/>'${item.title.encodeHTML()}' <break strength='medium'/>Do you want to play it?`
  }
};