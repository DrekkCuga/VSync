function loadUsername(elementId) {
    var username = getCookie('username');

    if (username !== null) {
        //set username as it is not null
        document.getElementById(elementId).value = username;
        return true;
    } else {
        return false;
    }
}

function createDropboxDirectLink() {
    var dropboxLink = prompt("Enter dropbox share link, the link will be converted and then set in the video url");

    if (dropboxLink !== null && dropboxLink !== "") {
        var mainLink = /www.dropbox/;
        var dlLink = /\?dl=0/;
        var dlLink2 = /\?dl=1/;
        dropboxLink = dropboxLink.replace(mainLink, 'dl.dropboxusercontent');
        dropboxLink = dropboxLink.replace(dlLink, '');
        dropboxLink = dropboxLink.replace(dlLink2, '');
        document.getElementById('inputVideoId').value = dropboxLink;
    }
}