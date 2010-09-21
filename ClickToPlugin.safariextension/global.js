var CTP_instance = 0; // incremented by one whenever a ClickToPlugin instance with content is created
const killers = [new YouTubeKiller(), new VimeoKiller(), new DailymotionKiller(), new VeohKiller(), new GenericKiller(), new SLKiller(), new QTKiller(), new WMKiller(), new DivXKiller()];

// UPDATE SETTINGS
if(safari.extension.settings["mustUpdateWhitelists"]) {
    safari.extension.settings["mustUpdateWhitelists"] = false;
    function updateWL(string) {
        if(/,/.test(safari.extension.settings[string])) safari.extension.settings[string] = safari.extension.settings[string].replace(/\s+/g, "").replace(/,/g, " ");
    }
    updateWL("redlist"); updateWL("greenlist"); updateWL("H264whitelist");
    updateWL("locwhitelist"); updateWL("locblacklist"); updateWL("srcwhitelist"); updateWL("srcblacklist");
}
if(safari.extension.settings["mustUpdateInvDim"]) {
    safari.extension.settings["mustUpdateInvDim"] = false;
    if(!/x/.test(safari.extension.settings["maxinvdim"])) safari.extension.settings["maxinvdim"] = safari.extension.settings["maxinvdim"] + "x" + safari.extension.settings["maxinvdim"];
}
// END UPDATE

function blockOrAllow(data) { // returns null if element can be loaded, the name of the plugin otherwise

    // no source and no type -> must allow, it's probably going to pass through here again after being modified by a script
    if(!data.src && !data.type) return null;

    // native Safari support
    var ext = extractExt(data.src); // used later as well
    if(data.type) {
        if(isNativeType(data.type)) return null;
    } else {
        if(isNativeExt(ext)) return null;
    }
    
    // Deal with invisible plugins
    if(safari.extension.settings["loadInvisible"] && data.width > 0 && data.height > 0) {
        var dim = safari.extension.settings["maxinvdim"];
        if(/^\d+x\d+$/.test(dim)) {
            dim = dim.split("x");
            if(data.width <= parseInt(dim[0]) && data.height <= parseInt(dim[1])) return null;
        }
    }
    
    // Deal with whitelisted content
    if(safari.extension.settings["uselocWhitelist"]) {
        if(safari.extension.settings["locwhitelist"]) {
            if(matchList(safari.extension.settings["locwhitelist"].split(/\s+/), data.location)) return null;
        }
        if(safari.extension.settings["locblacklist"]) {
            if(!matchList(safari.extension.settings["locblacklist"].split(/\s+/), data.location)) return null;
        }
    }
    if(safari.extension.settings["usesrcWhitelist"]) {
        if(safari.extension.settings["srcwhitelist"]) {
            if(matchList(safari.extension.settings["srcwhitelist"].split(/\s+/), data.src)) return null;
        }
        if(safari.extension.settings["srcblacklist"]) {
            if(!matchList(safari.extension.settings["srcblacklist"].split(/\s+/), data.src)) return null;
        }
    }
    
    // We use a 'soft' method to get the MIME type
    // It is not necessarily correct, but always returns a MIME type handled by the correct plugin
    // To get the correct MIME type an AJAX request would be needed, out of the question here!
    var plugin = null;
    var MIMEType = data.type;
    var pluginName = "?";
    if(MIMEType) plugin = getPluginForType(MIMEType);
    if(!plugin && data.src) {
        var x = getPluginAndTypeForExt(ext);
        if(x) {
            plugin = x.plugin;
            MIMEType = x.type;
        }
    }
    if(plugin) pluginName = getPluginNameFromPlugin(plugin);
    else if(MIMEType) pluginName = getPluginNameFromType(MIMEType);
    else if(data.classid) pluginName = getPluginNameFromClassid(data.classid.replace("clsid:", ""));
    // else if(data.src) pluginName = getPluginNameFromExt(ext);

    if(safari.extension.settings["allowQT"] && pluginName == "QuickTime") return null;
    
    // Use greenlist/redlist
    if(MIMEType) {
        if(safari.extension.settings["block"] == "useRedlist") {
            if(!matchList(safari.extension.settings["redlist"].split(/\s+/), MIMEType)) return null;
        } else if(safari.extension.settings["block"] == "useGreenlist") {
            if(matchList(safari.extension.settings["greenlist"].split(/\s+/), MIMEType)) return null;
        }
    }
    // At this point we know we should block the element
    
    // Exception: ask the user what to do if a QT object would launch QTP
    if(data.launchInQTP) {
        if(confirm(QT_CONFIRM_LAUNCH_DIALOG(data.launchInQTP))) {
            return null;
        }
    }
    
    return pluginName;
}


// EVENT LISTENERS
safari.application.addEventListener("message", respondToMessage, false);
safari.application.addEventListener("contextmenu", handleContextMenu, false);
safari.application.addEventListener("command", doCommand, false);
safari.extension.settings.addEventListener("change", handleChangeOfSettings, false);

function respondToMessage(event) {
    switch (event.name) {
        case "canLoad":
            event.message = respondToCanLoad(event.message);
            break;
        case "killPlugin":
            killPlugin(event.message);
            break;
    }
}

function respondToCanLoad(message) {
    // Make checks in correct order for optimal performance
    if(message.src !== undefined) return blockOrAllow(message);
    switch(message) {
        case "getSettings":
            return getSettings();
        case "getInstance":
            return ++CTP_instance;
        case "sIFR":
            if (safari.extension.settings["sifrReplacement"] == "textonly") {
                return {"canLoad": false, "debug": safari.extension.settings["debug"]};
            } else return {"canLoad": true};
        default: // return global variable with name message
            return this[message];
    }
}

function handleContextMenu(event) {
    if(!event.userInfo.instance) {
        if(safari.extension.settings["useLAcontext"] && event.userInfo.blocked > 0) event.contextMenu.appendContextMenuItem("loadall", LOAD_ALL_PLUGINS + " (" + event.userInfo.blocked + ")");
        if(safari.extension.settings["useWLcontext"]) {
            event.contextMenu.appendContextMenuItem("locwhitelist", ADD_TO_LOC_WHITELIST + "\u2026");
        }
        return;
    }
    var pluginName = /[A-Z]/.test(event.userInfo.plugin) ? event.userInfo.plugin : PLUGIN_GENERIC;
    if(event.userInfo.isVideo) {
        event.contextMenu.appendContextMenuItem(event.userInfo.instance + "," + event.userInfo.elementID + ",reload", RELOAD_IN_PLUGIN(pluginName));
        if(safari.extension.settings["useQTcontext"]) event.contextMenu.appendContextMenuItem(event.userInfo.instance + "," + event.userInfo.elementID + ",qtp", VIEW_IN_QUICKTIME_PLAYER);
        if(event.userInfo.siteInfo && safari.extension.settings["useVScontext"]) event.contextMenu.appendContextMenuItem("gotosite", VIEW_ON_SITE(event.userInfo.siteInfo.name));
    } else {
        if(event.userInfo.hasH264) {
            event.contextMenu.appendContextMenuItem(event.userInfo.instance + "," + event.userInfo.elementID + ",plugin", LOAD_PLUGIN(pluginName));
            event.contextMenu.appendContextMenuItem(event.userInfo.instance + "," + event.userInfo.elementID + ",remove", REMOVE_PLUGIN(pluginName));
            if(safari.extension.settings["useQTcontext"]) event.contextMenu.appendContextMenuItem(event.userInfo.instance + "," + event.userInfo.elementID + ",qtp", VIEW_IN_QUICKTIME_PLAYER);
            if(event.userInfo.siteInfo && safari.extension.settings["useVScontext"]) event.contextMenu.appendContextMenuItem("gotosite", VIEW_ON_SITE(event.userInfo.siteInfo.name));
        } else {
            event.contextMenu.appendContextMenuItem(event.userInfo.instance + "," + event.userInfo.elementID + ",remove", REMOVE_PLUGIN(pluginName));
        }
        if(safari.extension.settings["useWLcontext"]) {
            event.contextMenu.appendContextMenuItem("srcwhitelist", ADD_TO_SRC_WHITELIST + "\u2026");
        }
        // BEGIN DEBUG
        if(safari.extension.settings["debug"]) {
            event.contextMenu.appendContextMenuItem(event.userInfo.instance + "," + event.userInfo.elementID + ",show", SHOW_ELEMENT + " " + event.userInfo.instance + "." + event.userInfo.elementID);
        }
        //END DEBUG
    }
}

function doCommand(event) {
    switch(event.command) {
        case "gotosite":
            var newTab = safari.application.activeBrowserWindow.openTab("foreground");
            newTab.url = event.userInfo.siteInfo.url;
            break;
        case "locwhitelist":
            handleWhitelisting(true, event.userInfo.location);
            break;
        case "srcwhitelist":
            handleWhitelisting(false, event.userInfo.src);
            break;
        case "loadall":
            safari.application.activeBrowserWindow.activeTab.page.dispatchMessage("loadAll", "");
            break;
        default:
            safari.application.activeBrowserWindow.activeTab.page.dispatchMessage("loadContent", event.command);
            break;
    }
}

function handleWhitelisting (type, url) {
    var newWLstring = prompt(type ? ADD_TO_LOC_WHITELIST_DIALOG : ADD_TO_SRC_WHITELIST_DIALOG, url);
    if(newWLstring) {
        safari.extension.settings["use" + (type ? "loc" : "src") + "Whitelist"] = true;
        if(type && safari.extension.settings["locwhitelist"] == "www.example.com www.example2.com") { // get rid of the example
            safari.extension.settings[(type ? "loc" : "src") + "whitelist"] = newWLstring;
        } else {
            var space = safari.extension.settings[(type ? "loc" : "src") + "whitelist"] ? " " : "";
            safari.extension.settings[(type ? "loc" : "src") + "whitelist"] += space + newWLstring;
        }
        // load targeted content at once
        dispatchMessageToAllPages(type ? "locwhitelist" : "srcwhitelist", newWLstring);
    }
}

function handleChangeOfSettings(event) {
    if(event.key == "volume") {
        safari.application.activeBrowserWindow.activeTab.page.dispatchMessage("updateVolume", event.newValue);
    } else if(event.key = "opacity") {
        dispatchMessageToAllPages("updateOpacity", event.newValue);
    }
}

function getSettings() { // return the settings injected scripts need
    var settings = new Object();
    settings.useH264 = safari.extension.settings["useH264"];
    settings.usePlaylists = safari.extension.settings["usePlaylists"];
    settings.showPoster = safari.extension.settings["showPoster"];
    settings.H264behavior = safari.extension.settings["H264behavior"];
    settings.volume = safari.extension.settings["volume"];
    settings.sifrReplacement = safari.extension.settings["sifrReplacement"];
    settings.opacity = safari.extension.settings["opacity"];
    settings.debug = safari.extension.settings["debug"];
    return settings;
}

function findKillerFor(data) {
    for (var i = 0; i < killers.length; i++) {
        if(killers[i].canKill(data)) return i;
    }
    return null;
}

function killPlugin(data) {
    var killerID = findKillerFor(data);
    if(killerID === null) return;
    
    var callback = function(mediaData) {
        if(safari.extension.settings["H264autoload"]) {
            if(!safari.extension.settings["H264whitelist"]) mediaData.autoload = true;
            else {
                mediaData.autoload = matchList(safari.extension.settings["H264whitelist"].split(/\s+/), data.location);
            }
        }
        mediaData.elementID = data.elementID;
        mediaData.instance = data.instance;
        // the following messsage must be dispatched to all pages to make sure that
        // pages or tabs loading in the background get their mediaData
        dispatchMessageToAllPages("mediaData", mediaData);
    };
    killers[killerID].processElement(data, callback);
}

