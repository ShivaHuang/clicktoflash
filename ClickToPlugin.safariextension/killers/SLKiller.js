function SLKiller() {
    this.name = "SLKiller";
}

SLKiller.prototype.canKill = function(data) {
    if(!data.plugin == "Silverlight") return false;
    return (safari.extension.settings["QTbehavior"] > 1 && (hasSLVariable(data.params, "m") || hasSLVariable(data.params, "fileurl")));
};

SLKiller.prototype.processElement = function(data, callback) {
    var mediaURL = decodeURIComponent(getSLVariable(data.params, "m"));
    if(!mediaURL) mediaURL = decodeURIComponent(getSLVariable(data.params, "fileurl"));
    var mediaType = canPlaySrcWithHTML5(mediaURL);
    if(!mediaType) return;
    if(!mediaType.isNative && !canPlayWM) return;
    var isAudio = mediaType.type === "audio";
    
    var sources = [{"url": mediaURL, "isNative": mediaType.isNative}];
    var defaultSource = chooseDefaultSource(sources);
    
    var mediaData = {
        "playlist": [{"mediaType": mediaType,  "posterURL": decodeURIComponent(getSLVariable(data.params, "thumbnail")), "sources": sources, "defaultSource": defaultSource}],
        "badgeLabel": isAudio ? "Audio" : makeLabel(sources[defaultSource]),
        "isAudio": isAudio
    }
    callback(mediaData);
};