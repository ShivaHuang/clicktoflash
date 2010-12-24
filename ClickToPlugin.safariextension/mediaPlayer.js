/***************************
mediaPlayer class definition
****************************/

function mediaPlayer() {
    
    this.playerType; // audio or video
    this.playlist = new Array(); // array of mediaData objects
    this.playlistLength = 0; // not necessarily synced with playlist.length!
    
    this.startTrack = null; // internal start track is always 0
    // when startTrack is set, loadMedia can be called
    this.currentTrack = null; // for the user, current track is startTrack + currentTrack + 1
    // currentTrack is set iff loadMedia has been called
    this.currentSource = null; // the source being used for the currentTrack (an integer)
    
    this.containerElement = null;
    this.mediaElement = null; // the HTML video/audio element
    
    // dimensions of the container
    this.width = null;
    this.height = null;
    
    this.contextInfo = null;
    
    this.usePlaylistControls = false;
    this.useSourceSwitcher = false;
    this.playlistControls = null;
    this.sourceSwitcher = null;
    
}

mediaPlayer.prototype.handleMediaData = function(mediaData, usePlaylists, useSwitcher) {
    if(mediaData.loadAfter) { // just adding stuff to the playlist
        this.playlistLength -= mediaData.missed;
        this.addToPlaylist(mediaData.playlist);
    } else { // initial mediaData
        this.playerType = mediaData.isAudio ? "audio" : "video";
        this.addToPlaylist(mediaData.playlist, true);
        this.playlistLength = mediaData.playlistLength ? mediaData.playlistLength : mediaData.playlist.length;
        this.startTrack = mediaData.startTrack ? mediaData.startTrack : 0;

        this.usePlaylistControls = usePlaylists && !mediaData.noPlaylistControls && this.playlistLength > 1;
        this.useSourceSwitcher = useSwitcher && !mediaData.isAudio;
    }
};

mediaPlayer.prototype.createMediaElement = function(plugin, loadPlugin, width, height, buffer, volume, contextInfo) {
    this.containerElement = document.createElement("div");
    this.containerElement.className = "CTFmediaPlayer";
    this.mediaElement = document.createElement(this.playerType);
    this.mediaElement.className = "CTFvideoElement";
    this.containerElement.appendChild(this.mediaElement);
    
    this.mediaElement.setAttribute("controls", "controls");
    switch (buffer) {
        case "autoplay": 
            this.mediaElement.setAttribute("autoplay", "autoplay");
            break;
        case "buffer":
            this.mediaElement.setAttribute("preload", "auto");
            break;
        case "none":
            this.mediaElement.setAttribute("preload", "none");
            break;
    }
    
    // Set dimensions
    this.width = width;
    this.height = height;
    this.containerElement.style.width = width + "px";
    this.containerElement.style.height = height + "px";
    
    // Set volume
    this.mediaElement.volume = volume;
    
    // Set global contextInfo
    this.contextInfo = contextInfo;
    
    // Set listeners
    var _this = this; // need anonymous function in listeners otherwise the 'this' will refer to the mediaElement!
    this.mediaElement.addEventListener("contextmenu", function(event) {
        _this.setContextInfo(event, contextInfo, null);
        event.stopPropagation();
    }, false);
    this.mediaElement.addEventListener("loadedmetadata", function() {_this.fixAspectRatio();}, false);
    this.mediaElement.addEventListener("ended", function() {_this.nextTrack();}, false);
    this.mediaElement.addEventListener("dblclick", function(event) {
        if(event.target == this && event.offsetY + 24 < this.offsetHeight) {
            _this.switchLoop();
        }
    }, false);
    
    // Playlist constrols
    if(this.usePlaylistControls) this.initializePlaylistControls();
    if(this.useSourceSwitcher) this.initializeSourceSwitcher(plugin, loadPlugin);
};

mediaPlayer.prototype.initializePlaylistControls = function() {

    this.playlistControls = document.createElement("div");
    this.playlistControls.className = "CTFplaylistControls";
    
    var playlistControlsLeft = document.createElement("div");
    playlistControlsLeft.className = "CTFplaylistControlsLeft";
    this.playlistControls.appendChild(playlistControlsLeft);
    
    var playlistControlsRight = document.createElement("div");
    playlistControlsRight.className = "CTFplaylistControlsRight";
    this.playlistControls.appendChild(playlistControlsRight);
    
    var trackInfo = document.createElement("div");
    trackInfo.className = "CTFtrackInfo";
    playlistControlsLeft.appendChild(trackInfo);
    
    trackInfo.appendChild(document.createElement("p"));
    
    var prevButton = document.createElement("div");
    prevButton.className = "CTFprevButton";
    playlistControlsRight.appendChild(prevButton);
    
    var trackSelect = document.createElement("form");
    trackSelect.className = "CTFtrackSelect";
    playlistControlsRight.appendChild(trackSelect);
    
    var nextButton = document.createElement("div");
    nextButton.className = "CTFnextButton";
    playlistControlsRight.appendChild(nextButton);

    trackSelect.innerHTML = "<input type=\"text\" style=\"width: " + (7 * (this.playlistLength.toString().length - 1) + 8) + "px\"><span>/" + normalize(this.playlist.length, this.playlistLength) + "</span>";
    
    var _this = this;
    this.mediaElement.addEventListener("mouseover", function(event) {
        this.focus = true;
        if(!this.paused && this.readyState > 1) fade(_this.playlistControls, .05, .05, .9);
    }, false);
    this.playlistControls.addEventListener("mouseover", function(event) {
        _this.mediaElement.focus = true;
        if(!_this.mediaElement.paused && _this.mediaElement.readyState > 1) fade(_this.playlistControls, .05, 0, .9);
    }, false);
    this.mediaElement.addEventListener("mouseout", function(event) {
        // prevents the default controls from disappearing
        if(event.relatedTarget && (event.relatedTarget == prevButton || event.relatedTarget == nextButton || event.relatedTarget == trackSelect.firstChild || event.relatedTarget.hasAttribute("precision"))) {
            event.preventDefault();
        } else {
            this.focus = false;
            if(!this.paused && this.readyState > 1) fade(_this.playlistControls, .4, 0, 0);
        }
    }, false);
    this.playlistControls.addEventListener("mouseout", function(event) {
        _this.mediaElement.focus = false;
        if(!_this.mediaElement.paused && _this.mediaElement.readyState > 1) fade(_this.playlistControls, .4, .1, 0);
    }, false);
    this.mediaElement.focus = false;
    this.mediaElement.addEventListener("pause", function(){fade(_this.playlistControls, .05, 0, .9);}, false);
    this.mediaElement.addEventListener("play", function(){if(!_this.mediaElement.focus) fade(_this.playlistControls, .4, 0, 0);}, false);
    
    trackSelect.addEventListener("submit", function(event) {
        event.preventDefault();
        var track = this.getElementsByTagName("input")[0].value;
        if(!(/^\d+$/.test(track))) return;
        track = parseInt(track);
        if(track < 1 || track > _this.playlistLength) return;
        track = (track - _this.startTrack - 1 + _this.playlistLength) % _this.playlistLength;
        if(track == _this.currentTrack) return;
        if(track < _this.playlist.length) {
            _this.loadTrack(track, null, true);
        }
    }, false);
    prevButton.addEventListener("click", function() {
        if(_this.playlist.length == 1) return;
        _this.loadTrack(_this.currentTrack - 1, null, true);
    }, false);
    nextButton.addEventListener("click", function() {
        if(_this.playlist.length == 1) return;
        _this.loadTrack(_this.currentTrack + 1, null, true);
    }, false);
    
    this.containerElement.appendChild(this.playlistControls);
};

mediaPlayer.prototype.initializeSourceSwitcher = function(plugin, loadPlugin) {
    var _this = this;
    var handleClickEvent = function(event, source) {
        _this.switchSource(source);
        event.stopPropagation();
    };
    var handleContextMenuEvent = function(event, source) {
        _this.setContextInfo(event, _this.contextInfo, source);
        event.stopPropagation();
    };
    this.sourceSwitcher = new sourceSwitcher(plugin, loadPlugin, handleClickEvent, handleContextMenuEvent);
    
    this.mediaElement.addEventListener("mouseout", function(event) {
        if(event.relatedTarget && (event.relatedTarget.className === "CTFsourceList" || event.relatedTarget.parentNode.className === "CTFsourceList")) event.preventDefault();
    }, false);
    
    this.containerElement.appendChild(this.sourceSwitcher.element);
};

mediaPlayer.prototype.fixAspectRatio = function() {
    var w = this.mediaElement.videoWidth;
    var h = this.mediaElement.videoHeight;
    if(!w || !h) { // audio source
        this.mediaElement.style.width = this.width + "px"; this.mediaElement.style.height = (this.height < 24 ? "24" : this.height) + "px";
    } else if (w/h > this.width/this.height) {
        // No rounding to avoid stretching in fullscreen
        var height = h/w*this.width;
        this.mediaElement.style.width = this.width + "px"; this.mediaElement.style.height = height + "px";
        if(this.useSourceSwitcher) {
            this.sourceSwitcher.setPosition(0, this.height - height);
        }
    } else {
        var width = w/h*this.height;
        this.mediaElement.style.height = this.height + "px"; this.mediaElement.style.width = width + "px";
        if(this.playlistControls) {
            this.playlistControls.style.width = width + "px";
            if(this.usePlaylistControls) this.playlistControls.getElementsByTagName("p")[0].style.width = (width - this.playlistControls.getElementsByClassName("CTFplaylistControlsRight")[0].offsetWidth - 12) + "px";
        }
        if(this.useSourceSwitcher) {
            this.sourceSwitcher.setPosition((this.width - width)/2, 0);
        }
    }
    if(this.usePlaylistControls) {
        // need this otherwise webkit messes up font smoothing with hardware acceleration
        fade(this.playlistControls, .05, 0, .9);
    }
    
};

mediaPlayer.prototype.resetAspectRatio = function() {
    this.mediaElement.style.width = this.width + "px";
    this.mediaElement.style.height = this.height + "px";
    if(this.playlistControls) {
        this.playlistControls.style.width = this.width + "px";
        if(this.usePlaylistControls) this.playlistControls.getElementsByTagName("p")[0].style.width = (this.width - this.playlistControls.getElementsByClassName("CTFplaylistControlsRight")[0].offsetWidth - 12) + "px";
    }
    if(this.useSourceSwitcher) {
        this.sourceSwitcher.setPosition(0,0);
    }
};

mediaPlayer.prototype.switchLoop = function() {
    if(this.mediaElement.hasAttribute("loop")) this.mediaElement.removeAttribute("loop");
    else this.mediaElement.setAttribute("loop", "true");
};

mediaPlayer.prototype.nextTrack = function() {
    if(!this.mediaElement.hasAttribute("loop")) {
        if(this.currentTrack + this.startTrack + 1 == this.playlistLength) return;
        this.loadTrack(this.currentTrack + 1, null, true);
    }
};

mediaPlayer.prototype.loadTrack = function(track, source, autoplay) { // source MUST be an existing source or null for default
    track = track % this.playlist.length;
    if(track < 0) track += this.playlist.length; // weird JS behavior
    if(source === null) source = this.playlist[track].defaultSource;
    if(source === undefined) source = 0; // only happens for JW player playlists and no-MP4 YT playlists
    
    this.resetAspectRatio();
    this.mediaElement.src = this.playlist[track].sources[source].url;
    // If src is not set before poster, poster is not shown. Webkit bug?
    if(this.playlist[track].posterURL) {
        if(this.playlist[track].mediaType === "video") {
            this.mediaElement.poster = this.playlist[track].posterURL;
            this.mediaElement.style.backgroundImage = "none !important";
        } else {
            if(this.mediaElement.hasAttribute("poster")) this.mediaElement.removeAttribute("poster");
            this.mediaElement.style.backgroundImage = "url('" + this.playlist[track].posterURL + "') !important";
        }
    }  else {
        if(this.mediaElement.hasAttribute("poster")) this.mediaElement.removeAttribute("poster");
        this.mediaElement.style.backgroundImage = "none !important";
    }
    this.currentTrack = track;
    this.currentSource = source;
    if(autoplay) {
        this.mediaElement.setAttribute("preload", "auto");
        this.mediaElement.setAttribute("autoplay", "autoplay");
    }
    
    if(this.useSourceSwitcher) {
        this.sourceSwitcher.buildSourceList(this.playlist[track].sources);
        this.sourceSwitcher.setCurrentSource(source);
    }
    if(this.usePlaylistControls) {
        var title = this.playlist[track].title;
        if(!title) title = "(no title)";
        track = this.printTrack(track);
        this.playlistControls.getElementsByTagName("p")[0].innerHTML = track + ". " + title;
        
        var inputField = this.playlistControls.getElementsByTagName("input")[0];
        var newInputField = document.createElement("input");
        newInputField.setAttribute("type", "text");
        newInputField.setAttribute("value", track);
        newInputField.style.width = (7 * (this.playlistLength.toString().length - 1) + 8) + "px";
        // simply changing the value does not update if user has used the field
        this.playlistControls.getElementsByTagName("form")[0].replaceChild(newInputField, inputField);
        
        // Show playlist controls
        this.playlistControls.style.WebkitTransition = "";
        this.playlistControls.style.opacity = "1";
    }
};

mediaPlayer.prototype.switchSource = function(source) {
    if(source === this.currentSource) return;
        
    this.sourceSwitcher.setCurrentSource(source);
    
    var currentTime = this.mediaElement.currentTime;
    this.mediaElement.src = this.playlist[this.currentTrack].sources[source].url;
    this.currentSource = source;    
    
    var setInitialTime = function(event) {
        event.target.removeEventListener("loadedmetadata", setInitialTime, false);
        event.target.currentTime = currentTime;
    };
    this.mediaElement.addEventListener("loadedmetadata", setInitialTime, false);
};

mediaPlayer.prototype.printTrack = function(track) {
    return (track + this.startTrack) % this.playlistLength + 1;
};

mediaPlayer.prototype.setContextInfo = function(event, contextInfo, source) {
    var track = this.currentTrack;
    if(track === null) track = 0;
    contextInfo.mediaType = this.playlist[track].mediaType;
    contextInfo.siteInfo = this.playlist[track].siteInfo;
    contextInfo.isVideo = this.currentTrack !== null;
    if(source === null) {
        if(this.currentSource !== null) contextInfo.source = this.currentSource;
        else contextInfo.source = this.playlist[track].defaultSource;
    } else contextInfo.source = source;
    safari.self.tab.setContextMenuEventUserInfo(event, contextInfo);
};

mediaPlayer.prototype.addToPlaylist = function(playlist, init) {
    if(init) this.playlist = playlist.concat(this.playlist);
    else this.playlist = this.playlist.concat(playlist);
    if(this.usePlaylistControls && this.playlistControls) {
        this.playlistControls.getElementsByTagName("span")[0].innerHTML = "/" + normalize(this.playlist.length + this.startTrack, this.playlistLength);
    }
};

function fade(element, duration, delay, opacity) {
    element.style.WebkitTransition = "opacity " + duration + "s linear " + delay + "s";
    element.style.opacity = opacity;
};

function normalize(n,m) {
    if(n > m) return m.toString();
    var string = n.toString();
    while(string.length < m.toString().length) {
        string = "0" + string;
    }
    return string;
}


