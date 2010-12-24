function GenericKiller() {
    this.name = "GenericKiller";
}

GenericKiller.prototype.canKill = function(data) {
    if(hasFlashVariable(data.params, "streamer")) data.streamer = true;
    if(hasFlashVariable(data.params, "file")) {data.file = "file"; return true;}
    if(hasFlashVariable(data.params, "load")) {data.file = "load"; return true;}
    if(hasFlashVariable(data.params, "playlistfile")) {data.playlist = "playlistfile"; return true;}
    if(hasFlashVariable(data.params, "src")) {data.file = "src"; return true;}
    if(hasFlashVariable(data.params, "mp3")) {data.file = "mp3"; return true;}
    if(hasFlashVariable(data.params, "soundFile")) {data.file = "soundFile"; return true;}
    //if(hasFlashVariable(data.params, "url")) {data.file = "url"; return true;}
    if(/[?&]file=/.test(data.src)) return true;
    return false;
};

GenericKiller.prototype.processElement = function(data, callback) {
    if(data.streamer) {// streams are not supported
        if(getFlashVariable(data.params, "streamer").substring(0,4) === "rtmp") return;
    }
    var sources = new Array();
    var playlistURL = decodeURIComponent(getFlashVariable(data.params, data.playlist)); // JW player & TS player
    var sourceURL = decodeURIComponent(getFlashVariable(data.params, data.file));
    if(!sourceURL) {
        sourceURL = data.src.match(/[?&]file=([^&]*)(?:&|$)/);
        if(sourceURL) sourceURL = decodeURIComponent(sourceURL[1]);
    }
    // Site-specific decoding
    if(/player_mp3_maxi\.swf$/.test(data.src)) sourceURL = sourceURL.replace(/\+/g, "%20");
    
    var posterURL = decodeURIComponent(getFlashVariable(data.params, "image"));
    //if(!posterURL) posterURL = decodeURIComponent(getFlashVariable(data.params, "thumbnail"));
    if(!posterURL) {
        posterURL = data.src.match(/[?&]image=([^&]*)(?:&|$)/);
        if(posterURL) posterURL = decodeURIComponent(posterURL[1]);
    }
    
    // Playlist support
    if(safari.extension.settings["usePlaylists"]) {
        if(playlistURL) {
            this.processElementFromPlaylist(playlistURL, data.baseURL, posterURL, getFlashVariable(data.params, "item"), callback);
            return;
        }
        if(hasExt("xml", sourceURL)) {
            this.processElementFromPlaylist(sourceURL, data.baseURL, posterURL, getFlashVariable(data.params, "item"), callback);
            return;
        }
    }
    
    var sourceURL2 = getFlashVariable(data.params, "real_file");
    if(sourceURL2) sourceURL = decodeURIComponent(sourceURL2);
    
    var mediaType = canPlaySrcWithHTML5(sourceURL);
    if(!mediaType) return;
    var isAudio = mediaType.type === "audio";
    
    sourceURL2 = getFlashVariable(data.params, "hd.file");
    if(sourceURL2) {
        var m = canPlaySrcWithHTML5(sourceURL2);
        if(m) sources.push({"url": sourceURL2, "format": "HD", "isNative": m.isNative, "resolution": 720});
    }
    
    sources.push({"url": sourceURL, "format": sources[0] ? "SD" : "", "isNative": mediaType.isNative});
    
    var defaultSource = chooseDefaultSource(sources);
    
    var mediaData = {
        "playlist": [{"mediaType": mediaType.type, "posterURL": posterURL, "sources": sources, "defaultSource": defaultSource}],
        "badgeLabel": isAudio ? "Audio" : makeLabel(sources[defaultSource]),
        "isAudio": isAudio
    };
    callback(mediaData);
};

GenericKiller.prototype.processElementFromPlaylist = function(playlistURL, baseURL, posterURL, track, callback) {
    var handlePlaylistData = function(playlistData) {
        playlistData.badgeLabel = playlistData.playlist[0].mediaType === "audio" ? "Audio" : makeLabel(playlistData.playlist[0].sources[0]);
        callback(playlistData);
    };
    
    playlistURL = makeAbsoluteURL(playlistURL, baseURL);
    parseXSPFPlaylist(playlistURL, posterURL, track, handlePlaylistData);
};

