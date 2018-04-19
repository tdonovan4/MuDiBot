module.exports = {
  search: function(url) {
    var videoId = `${url}123`;
    return {
      items: [
        {
          id: {
            videoId: videoId
          }
        }
      ]
    }
  },
  videos: function(videoId) {
    return {
      items: [
        {
          id: videoId,
          snippet: {
            title: `A video ${videoId}`
          },
          contentDetails: {
            duration: '1M30S'
          }
        }
      ]
    }
  }
}
