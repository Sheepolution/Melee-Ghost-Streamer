window.onload = init;
window.onerror = logError;

const Jimp = require("jimp");

const OBSWebSocket = require('obs-websocket-js').default;
const obs = new OBSWebSocket()

obs.on('ConnectionOpened', () => {
    console.log('Connected to OBS WebSocket');

    obsConnected = true;

    document.getElementById("sceneGameStart").disabled = !autoSwitchScenes.checked;
    document.getElementById("sceneGameStartDelay").disabled = !autoSwitchScenes.checked;
    document.getElementById("sceneGameEnd").disabled = !autoSwitchScenes.checked;
    document.getElementById("sceneGameEndDelay").disabled = !autoSwitchScenes.checked;
    document.getElementById("sceneSetEnd").disabled = !autoSwitchScenes.checked;
    document.getElementById("sceneSetEndDelay").disabled = !autoSwitchScenes.checked;

    document.getElementById("connectOBSStatus").textContent = "Connected";
});

obs.on('ConnectionClosed', () => {

    obsConnected = false;

    document.getElementById("sceneGameStart").disabled = true;
    document.getElementById("sceneGameStartDelay").disabled = true;
    document.getElementById("sceneGameEnd").disabled = true;
    document.getElementById("sceneGameEndDelay").disabled = true;
    document.getElementById("sceneSetEnd").disabled = true;
    document.getElementById("sceneSetEndDelay").disabled = true;

    document.getElementById("connectOBSStatus").textContent = "Disconnected";
});

obs.on('ConnectionError', (err) => {
    obsConnected = false;
    document.getElementById("connectOBSStatus").textContent = "Error: " + err.error;
    console.error('Failed to connect: ' + err);
    logError(`Failed to connect to OBS: ${err}`);
});

const rootPath = process.env.DEV_ENV ? path.join(__dirname, '..', '..')
    : process.platform == 'win32' ? process.env.PORTABLE_EXECUTABLE_DIR
        : path.dirname(process.env.APPIMAGE);

const mainPath = path.join(rootPath, 'resources');
const textPath = path.join(rootPath, 'resources', 'Texts');
const charPath = path.join(rootPath, 'resources', 'Characters');
const recordingsPath = path.join(rootPath, 'resources', 'Recordings');
const playerPath = path.join(rootPath, 'resources', 'Players');

const noop = () => { };

const fieldIds = [
    "slippiDirectory",
    "recordingPath",
    "obsURL",
    "obsPort",
    "startggUrl",
    "p1Pronouns",
    "p1Tag",
    "p1Name",
    "p2Pronouns",
    "p2Tag",
    "p2Name",
    "roundName",
    "tournamentName",
    "cName1",
    "cTwitter1",
    "cTwitch1",
    "cName2",
    "cTwitter2",
    "cTwitch2",
    "nextP1",
    "nextP2",
    "nextRound",
    "sceneGameStart",
    "sceneGameStartDelay",
    "sceneGameEnd",
    "sceneGameEndDelay",
    "sceneSetEnd",
    "sceneSetEndDelay",
    "replayDuration"
]

const checkboxIds = [
    "toggleStartgg",
    "p1Auto",
    "pPort",
    "p2Auto",
    "nextAuto",
    "allowIntro",
    "forceWLToggle",
    "makeUppercase",
    "addSpace",
    "pgStats",
    "replayShort",
    "setVods"
]

function saveFieldValuesToStorage() {
    for (const id of fieldIds) {
        const field = document.getElementById(id);
        if (field) {
            localStorage.setItem(id, field.value);
        }
    }

    for (const id of checkboxIds) {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            localStorage.setItem(id, checkbox.checked);
        }
    }
}

function restoreFieldValuesFromStorage() {
    for (const id of fieldIds) {
        const field = document.getElementById(id);
        if (field) {
            field.value = localStorage.getItem(id);
            if (field.oninput) {
                field.oninput(field);
            }
        }
    }

    for (const id of checkboxIds) {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.checked = localStorage.getItem(id) === 'true';
            if (checkbox.onclick) {
                checkbox.onclick(checkbox);
            }
        }
    }

    handleButtonDisabling();
}

function handleButtonDisabling() {
    if (!startggBracket) {
        document.getElementById("fetchStartGG").disabled = true;
    }

    if (!obsRecordingPath) {
        document.getElementById("replayButton").disabled = true;
        document.getElementById("thumbnailButton").disabled = true;
        document.getElementById("shortButton").disabled = true;
    }
}

//yes we all like global variables
let charP1 = "Random";
let charP2 = "Random";
let skinP1 = "";
let skinP2 = "";
let portP1 = 1;
let portP2 = 2;
let colorP1, colorP2;
let currentP1WL = "Nada";
let currentP2WL = "Nada";
let currentBestOf = "Best of 3";

let movedSettings = false;
let charP1Active = false;

let scoreP1 = 0;
let scoreP2 = 0;

let setHistory = '? - ?';

const viewport = document.getElementById('viewport');

const obsURLInp = document.getElementById('obsURL');
const obsPortInp = document.getElementById('obsPort');
const obsPasswordInp = document.getElementById('obsPassword');

const p1NameInp = document.getElementById('p1Name');
const p1TagInp = document.getElementById('p1Tag');
const p1PronounsInp = document.getElementById('p1Pronouns');
const p1Auto = document.getElementById('p1Auto');
p1Auto.onclick = (e) => {
    if (p1Auto.checked) {
        if (player1Data) {
            p1NameInp.value = player1Data.name;
        }
    }
}

const p2NameInp = document.getElementById('p2Name');
const p2TagInp = document.getElementById('p2Tag');
const p2PronounsInp = document.getElementById('p2Pronouns');
const p2Auto = document.getElementById('p2Auto');
p2Auto.onclick = (e) => {
    if (p2Auto.checked) {
        if (player2Data) {
            p2NameInp.value = player2Data.name;
        }
    }
}

const charImgP1 = document.getElementById('p1CharImg');
const charImgP2 = document.getElementById('p2CharImg');

const p1Score = document.getElementById('p1Score');
p1Score.oninput = () => scoreP1 = p1Score.value;
const p2Score = document.getElementById('p2Score');
p2Score.oninput = () => scoreP2 = p2Score.value;

const p1W = document.getElementById('p1W');
const p1L = document.getElementById('p1L');
const p2W = document.getElementById('p2W');
const p2L = document.getElementById('p2L');

const roundInp = document.getElementById('roundName');
roundInp.onchange = () => {
    localStorage.setItem('roundName', roundInp.value);
}

const forceWL = document.getElementById('forceWLToggle');
const makeUppercase = document.getElementById('makeUppercase');
const addSpace = document.getElementById('addSpace');
const pgStats = document.getElementById('pgStats');
const setVods = document.getElementById('setVods');

const p1NameNextInp = document.getElementById('nextP1');
const p2NameNextInp = document.getElementById('nextP2');
const roundNextInp = document.getElementById('nextRound');
const nextAutoInp = document.getElementById('nextAuto');

const autoSwitchScenes = document.getElementById('autoSwitchScenes');
const sceneGameStartInp = document.getElementById('sceneGameStart');
const sceneGameStartDelayInp = document.getElementById('sceneGameStartDelay');

const sceneGameEndInp = document.getElementById('sceneGameEnd');
const sceneGameEndDelayInp = document.getElementById('sceneGameEndDelay');

const sceneSetEndInp = document.getElementById('sceneSetEnd');
const sceneSetEndDelayInp = document.getElementById('sceneSetEndDelay');

let previousStartggP1 = ''
let previousStartggP2 = ''

let player1Data;
let player2Data;

let previousName1;
let previousName2;

let crewsStocksPlayer;
let crewsStocksLeft = 0;
let crewsNextRound;

let setStartTime;
let setOfficiallyStarted;
let obsRecordingPath = '';

let startggOn;
let startggTimeout;
let startggBracket;

let portPrioSwapped = false;

let videoData;
let cachedVideoData;

let obsConnected = false;
let sceneSwitchTimeout;

function init() {
    onGameStarted(updatePlayers)
    onGameFinished(updateScore)
    onReplay(createReplay)

    //first, add listeners for the bottom bar buttons
    document.getElementById('updateRegion').addEventListener("click", writeScoreboard);
    document.getElementById('settingsRegion').addEventListener("click", moveViewport);

    //if the viewport is moved, click anywhere on the center to go back
    document.getElementById('goBack').addEventListener("click", goBack);

    //move the viewport to the center (this is to avoid animation bugs)
    viewport.style.right = "100%";


    /* OVERLAY */

    //load color slot list
    loadColors(1);
    loadColors(2);


    //set initial values for the character selectors
    document.getElementById('p1CharSelector').setAttribute('src', charPath + '/CSS/Random.png');
    document.getElementById('p2CharSelector').setAttribute('src', charPath + '/CSS/Random.png');
    //if clicking them, show the character roster
    document.getElementById('p1CharSelector').addEventListener("click", openChars);
    document.getElementById('p2CharSelector').addEventListener("click", openChars);

    //create the character roster
    createCharRoster();
    //if clicking the entirety of the char roster div, hide it
    document.getElementById('charRoster').addEventListener("click", hideChars);

    //update the character image (to random)
    charImgChange(charImgP1, "Random", colorP1);
    charImgChange(charImgP2, "Random", colorP2);

    //check whenever an image isnt found so we replace it with a "?"
    document.getElementById('p1CharImg').addEventListener("error", () => {
        document.getElementById('p1CharImg').setAttribute('src', charPath + '/Portraits/Random ' + colorP1 + '.png');
    });
    document.getElementById('p2CharImg').addEventListener("error", () => {
        document.getElementById('p2CharImg').setAttribute('src', charPath + '/Portraits/Random ' + colorP2 + '.png');
    });

    p1W.addEventListener("click", setWLP1);
    p1L.addEventListener("click", setWLP1);
    p2W.addEventListener("click", setWLP2);
    p2L.addEventListener("click", setWLP2);

    //check whenever the player's name has a skin
    p1NameInp.addEventListener("input", resizeInput);
    p2NameInp.addEventListener("input", resizeInput);

    //resize the box whenever the user types
    p1TagInp.addEventListener("input", resizeInput);
    p2TagInp.addEventListener("input", resizeInput);

    //set click listeners to change the "best of" status
    document.getElementById("bo3Div").addEventListener("click", changeBestOf);
    document.getElementById("bo5Div").addEventListener("click", changeBestOf);
    document.getElementById("boCrews").addEventListener("click", changeBestOf);
    document.getElementById("boEndless").addEventListener("click", changeBestOf);
    //set initial value
    document.getElementById("bo3Div").style.color = "linear-gradient(to top, #575757, #00000000)";
    document.getElementById("bo5Div").style.backgroundImage = "var(--text2)";
    document.getElementById("boCrews").style.backgroundImage = "var(--text2)";
    document.getElementById("boEndless").style.backgroundImage = "var(--text2)";


    //check if the round is grand finals
    roundInp.addEventListener("input", checkRound);


    //add a listener to the swap button
    document.getElementById('swapButton').addEventListener("click", swap);
    //add a listener to the clear button
    document.getElementById('clearButton').addEventListener("click", clearPlayers);


    /* SETTINGS */

    //set a listener for the forceWL check
    forceWL.addEventListener("click", forceWLtoggles);

    /* KEYBOARD SHORTCUTS */

    Mousetrap.bind('enter', () => {
        writeScoreboard();
        document.getElementById('botBar').style.backgroundColor = "var(--bg3)";
    }, 'keydown');
    Mousetrap.bind('enter', () => {
        document.getElementById('botBar').style.backgroundColor = "var(--bg5)";
    }, 'keyup');

    Mousetrap.bind('esc', () => {
        if (movedSettings) { //if settings are open, close them
            goBack();
        } else if (document.getElementById('charRoster').style.opacity == 1) {
            hideChars(); //if charRoster is visible, hide it
        } else {
            clearPlayers();
        }
    });

    Mousetrap.bind('f1', () => { giveWinP1() });
    Mousetrap.bind('f2', () => { giveWinP2() });
    Mousetrap.bind('f9', () => { createReplay(true) });
}

function setRecordingPath(path) {
    obsRecordingPath = path;
    document.getElementById("replayButton").disabled = !obsRecordingPath;
    document.getElementById("thumbnailButton").disabled = !obsRecordingPath;
    document.getElementById("shortButton").disabled = !obsRecordingPath;
}

function setStartggBracketUrl(url) {
    startggBracket = url;
    document.getElementById("fetchStartGG").disabled = !startggBracket;
}


function moveViewport() {
    if (!movedSettings) {
        viewport.style.right = "140%";
        document.getElementById('overlay').style.opacity = "25%";
        document.getElementById('goBack').style.display = "block"
        movedSettings = true;
    }
}

function goBack() {
    viewport.style.right = "100%";
    document.getElementById('overlay').style.opacity = "100%";
    document.getElementById('goBack').style.display = "none";
    movedSettings = false;
}


//called whenever we need to read a json file
function getJson(fileName) {
    try {
        let settingsRaw = fs.readFileSync(mainPath + "/" + fileName + ".json");
        return JSON.parse(settingsRaw);
    } catch (error) {
        return undefined;
    }
}

function getTextJson(fileName) {
    try {
        let settingsRaw = fs.readFileSync(textPath + "/" + fileName + ".json");
        return JSON.parse(settingsRaw);
    } catch (error) {
        return undefined;
    }
}


//will load the color list to a color slot combo box
function loadColors(pNum) {
    let colorList = getTextJson("InterfaceInfo"); //check the color list

    //for each color found, add them to the color list
    for (let i = 0; i < Object.keys(colorList.colorSlots).length; i++) {

        //create a new div that will have the color info
        let newDiv = document.createElement('div');
        newDiv.style.display = "flex"; //so everything is in 1 line
        newDiv.title = "Also known as " + colorList.colorSlots["color" + i].hex;
        newDiv.className = "colorEntry";

        //if the div gets clicked, update the colors
        newDiv.addEventListener("click", updateColor);

        //create the color's name
        let newText = document.createElement('div');
        newText.innerHTML = colorList.colorSlots["color" + i].name;

        //create the color's rectangle
        let newRect = document.createElement('div');
        newRect.style.width = "13px";
        newRect.style.height = "13px";
        newRect.style.margin = "5px";
        newRect.style.backgroundColor = colorList.colorSlots["color" + i].hex;

        //add them to the div we created before
        newDiv.appendChild(newRect);
        newDiv.appendChild(newText);

        //now add them to the actual interface
        document.getElementById("dropdownColorP" + pNum).appendChild(newDiv);
    }

    //set the initial colors for the interface (the first color for p1, and the second for p2)
    if (pNum == 1) {
        document.getElementById("player1").style.backgroundImage = "linear-gradient(to bottom left, " + colorList.colorSlots["color" + 0].hex + "50, #00000000, #00000000)";
        document.getElementById("p1ColorRect").style.backgroundColor = colorList.colorSlots["color" + 0].hex;
    } else {
        document.getElementById("player2").style.backgroundImage = "linear-gradient(to bottom left, " + colorList.colorSlots["color" + 1].hex + "50, #00000000, #00000000)";
        document.getElementById("p2ColorRect").style.backgroundColor = colorList.colorSlots["color" + 1].hex;
    }

    //finally, set initial values for the global color variables
    colorP1 = "Red";
    colorP2 = "Blue";
}

function updateColor(e, n, c) {
    let pNum; //you've seen this one enough already, right?
    if (!n) {
        if (this.parentElement.parentElement == document.getElementById("p1Color")) {
            pNum = 1;
        } else {
            pNum = 2;
        }
    } else {
        pNum = n;
    }

    let colorList = getTextJson("InterfaceInfo");
    let clickedColor = c ? colorList.colorSlots["color" + (c - 1)].name : this.textContent;

    //search for the color we just clicked
    for (let i = 0; i < Object.keys(colorList.colorSlots).length; i++) {
        if (colorList.colorSlots["color" + i].name == clickedColor) {
            let colorRectangle, colorGrad;

            colorRectangle = document.getElementById("p" + pNum + "ColorRect");
            colorGrad = document.getElementById("player" + pNum);

            //change the variable that will be read when clicking the update button
            if (pNum == 1) {
                colorP1 = colorList.colorSlots["color" + i].name;
            } else {
                colorP2 = colorList.colorSlots["color" + i].name;
            }

            //then change both the color rectangle and the background gradient
            colorRectangle.style.backgroundColor = colorList.colorSlots["color" + i].hex;
            colorGrad.style.backgroundImage = "linear-gradient(to bottom left, " + colorList.colorSlots["color" + i].hex + "50, #00000000, #00000000)";

            //also, if random is up, change its color
            if (pNum == 1) {
                if (charP1 == "Random") {
                    document.getElementById('p1CharImg').setAttribute('src', charPath + '/Portraits/Random ' + colorP1 + '.png');
                }
            } else {
                if (charP2 == "Random") {
                    document.getElementById('p2CharImg').setAttribute('src', charPath + '/Portraits/Random ' + colorP2 + '.png');
                }
            }

        }
    }

    //remove focus from the menu so it hides on click
    if (!n) {
        this.parentElement.parentElement.blur();
    }
}


//change the image path depending on the character and skin
function charImgChange(charImg, charName, skinName = "Default") {
    if (charName == "Random") {
        charImg.setAttribute('src', charPath + '/Portraits/Random ' + skinName + '.png');
    } else {
        charImg.setAttribute('src', charPath + '/Portraits/' + charName + '/' + skinName + '.png');
    }
}


function createCharRoster() {
    //checks the character list which we use to order stuff
    const guiSettings = getTextJson("InterfaceInfo");

    //first row
    for (let i = 0; i < 9; i++) {
        let newImg = document.createElement('img');
        newImg.className = "charInRoster";
        newImg.setAttribute('src', charPath + '/CSS/' + guiSettings.charactersBase[i] + '.png');

        newImg.id = guiSettings.charactersBase[i]; //we will read this value later
        newImg.addEventListener("click", changeCharacter);

        document.getElementById("rosterLine1").appendChild(newImg);
    }
    //second row
    for (let i = 9; i < 19; i++) {
        let newImg = document.createElement('img');
        newImg.className = "charInRoster";

        newImg.id = guiSettings.charactersBase[i];
        newImg.addEventListener("click", changeCharacter);

        newImg.setAttribute('src', charPath + '/CSS/' + guiSettings.charactersBase[i] + '.png');
        document.getElementById("rosterLine2").appendChild(newImg);
    }
    //third row
    for (let i = 19; i < 26; i++) {
        let newImg = document.createElement('img');
        newImg.className = "charInRoster";

        newImg.id = guiSettings.charactersBase[i];
        newImg.addEventListener("click", changeCharacter);

        newImg.setAttribute('src', charPath + '/CSS/' + guiSettings.charactersBase[i] + '.png');
        document.getElementById("rosterLine3").appendChild(newImg);
    }
}

//whenever we click on the character change button
function openChars() {
    charP1Active = false; //simple check to know if this is P1 or P2, used on other functions
    if (this == document.getElementById('p1CharSelector')) {
        charP1Active = true;
    }

    document.getElementById('charRoster').style.display = "flex"; //show the thing
    setTimeout(() => { //right after, change opacity and scale
        document.getElementById('charRoster').style.opacity = 1;
        document.getElementById('charRoster').style.transform = "scale(1)";
    }, 0);
}
//to hide the character grid
function hideChars() {
    document.getElementById('charRoster').style.opacity = 0;
    document.getElementById('charRoster').style.transform = "scale(1.2)";
    setTimeout(() => {
        document.getElementById('charRoster').style.display = "none";
    }, 200);
}

//called whenever clicking an image in the character roster
function changeCharacter() {
    if (charP1Active) {
        charP1 = this.id;
        skinP1 = "Default";
        document.getElementById('p1CharSelector').setAttribute('src', charPath + '/CSS/' + charP1 + '.png');
        charImgChange(charImgP1, charP1);
        addSkinIcons(1);
    } else {
        charP2 = this.id;
        skinP2 = "Default";
        document.getElementById('p2CharSelector').setAttribute('src', charPath + '/CSS/' + charP2 + '.png');
        charImgChange(charImgP2, charP2);
        addSkinIcons(2);
    }
}
//same as above but for the swap button
function changeCharacterManual(char, pNum) {
    document.getElementById('p' + pNum + 'CharSelector').setAttribute('src', charPath + '/CSS/' + char + '.png');
    if (pNum == 1) {
        charP1 = char;
        skinP1 = "Default";
        charImgChange(charImgP1, char);
        addSkinIcons(1);
    } else {
        charP2 = char;
        skinP2 = "Default";
        charImgChange(charImgP2, char);
        addSkinIcons(2);
    }
}
//also called when we click those images
function addSkinIcons(pNum) {
    document.getElementById('skinListP' + pNum).innerHTML = ''; //clear everything before adding
    let charInfo;
    if (pNum == 1) { //ahh the classic 'which character am i' check
        charInfo = getTextJson("Character Info/" + charP1);
    } else {
        charInfo = getTextJson("Character Info/" + charP2);
    }


    if (charInfo != undefined) { //if character doesnt have a list (for example: Random), skip this
        //add an image for every skin on the list
        for (let i = 0; i < charInfo.skinList.length; i++) {
            let newImg = document.createElement('img');
            newImg.className = "skinIcon";
            newImg.id = charInfo.skinList[i];
            newImg.title = charInfo.skinList[i];

            if (pNum == 1) {
                newImg.setAttribute('src', charPath + '/Stock Icons/' + charP1 + '/' + charInfo.skinList[i] + '.png');
                newImg.addEventListener("click", changeSkinP1);
            } else {
                newImg.setAttribute('src', charPath + '/Stock Icons/' + charP2 + '/' + charInfo.skinList[i] + '.png');
                newImg.addEventListener("click", changeSkinP2);
            }

            document.getElementById('skinListP' + pNum).appendChild(newImg);
        }

        document.getElementById('skinSelectorP1').style.height = "30px";
        document.getElementById('skinListP1').style.marginTop = "-1px";
        document.getElementById('skinListP1Sheik').innerHTML = '';

        document.getElementById('skinSelectorP2').style.height = "30px";
        document.getElementById('skinListP2').style.marginTop = "-1px";
        document.getElementById('skinListP2Sheik').innerHTML = '';
    }

    //if the list only has 1 skin or none, hide the skin list
    if (document.getElementById('skinListP' + pNum).children.length <= 1) {
        document.getElementById('skinSelectorP' + pNum).style.opacity = 0;
    } else {
        document.getElementById('skinSelectorP' + pNum).style.opacity = 1;
    }
}
//whenever clicking on the skin images
function changeSkinP1() {
    skinP1 = this.id;
    charImgChange(charImgP1, charP1, skinP1);
}
function changeSkinP2() {
    skinP2 = this.id;
    charImgChange(charImgP2, charP2, skinP2);
}

//returns how much score does a player have
function checkScore(el) {
    return el.value;
}

//gives a victory to player 1 
function giveWinP1() {
    scoreP1 = checkScore(p1Score);
    scoreP1 = parseInt(scoreP1) + 1;
    setScore(scoreP1, p1Score);
}

//same with P2
function giveWinP2() {
    scoreP2 = checkScore(p2Score);
    scoreP2 = parseInt(scoreP2) + 1;
    setScore(scoreP2, p2Score);
}


function setWLP1() {
    if (this == p1W) {
        currentP1WL = "W";
        this.style.color = "var(--text1)";
        p1L.style.color = "var(--text2)";
        this.style.backgroundImage = "linear-gradient(to top, #575757, #00000000)";
        p1L.style.backgroundImage = "var(--bg4)";
    } else {
        currentP1WL = "L";
        this.style.color = "var(--text1)";
        p1W.style.color = "var(--text2)";
        this.style.backgroundImage = "linear-gradient(to top, #575757, #00000000)";
        p1W.style.backgroundImage = "var(--bg4)";
    }
}
function setWLP2() {
    if (this == p2W) {
        currentP2WL = "W";
        this.style.color = "var(--text1)";
        p2L.style.color = "var(--text2)";
        this.style.backgroundImage = "linear-gradient(to top, #575757, #00000000)";
        p2L.style.backgroundImage = "var(--bg4)";
    } else {
        currentP2WL = "L";
        this.style.color = "var(--text1)";
        p2W.style.color = "var(--text2)";
        this.style.backgroundImage = "linear-gradient(to top, #575757, #00000000)";
        p2W.style.backgroundImage = "var(--bg4)";
    }
}
function deactivateWL() {
    currentP1WL = "Nada";
    currentP2WL = "Nada";
    document.getElementById;

    pWLs = document.getElementsByClassName("wlBox");
    for (let i = 0; i < pWLs.length; i++) {
        pWLs[i].style.color = "var(--text2)";
        pWLs[i].style.backgroundImage = "var(--bg4)";
    }
}


//same code as above but just for the player tag
function resizeInput() {
    changeInputWidth(this);
}

//changes the width of an input box depending on the text
function changeInputWidth(input) {
    input.style.width = getTextWidth(input.value,
        window.getComputedStyle(input).fontSize + " " +
        window.getComputedStyle(input).fontFamily
    ) + 12 + "px";
}


//used to get the exact width of a text considering the font used
function getTextWidth(text, font) {
    let canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement("canvas"));
    let context = canvas.getContext("2d");
    context.font = font;
    let metrics = context.measureText(text);
    return metrics.width;
}


//used when clicking on the "Best of" buttons
function changeBestOf() {
    let theOtherBestOf1; //we always gotta know
    let theOtherBestOf2; //we always gotta know
    let theOtherBestOf3; //we always gotta know
    if (this == document.getElementById("bo5Div")) {
        currentBestOf = "Best of 5";
        theOtherBestOf1 = document.getElementById("bo3Div");
        theOtherBestOf2 = document.getElementById("boCrews");
        theOtherBestOf3 = document.getElementById("boEndless");
        const winText = document.getElementsByClassName("winText");
        for (let i = 0; i < winText.length; i++) {
            winText[i].innerHTML = "Wins";
        }
    } else if (this == document.getElementById("bo3Div")) {
        currentBestOf = "Best of 3";
        theOtherBestOf1 = document.getElementById("bo5Div");
        theOtherBestOf2 = document.getElementById("boCrews");
        theOtherBestOf3 = document.getElementById("boEndless");
        const winText = document.getElementsByClassName("winText");
        for (let i = 0; i < winText.length; i++) {
            winText[i].innerHTML = "Wins";
        }
    } else if (this == document.getElementById("boCrews")) {
        currentBestOf = "Crews";
        theOtherBestOf1 = document.getElementById("bo3Div");
        theOtherBestOf2 = document.getElementById("bo5Div");
        theOtherBestOf3 = document.getElementById("boEndless");
        roundInp.value = "Game 1";
        crewsNextRound = null;
        crewsStocksPlayer = null;
        crewsStocksLeft = 0;
        const winText = document.getElementsByClassName("winText");
        for (let i = 0; i < winText.length; i++) {
            winText[i].innerHTML = "Stocks";
        }
    } else if (this == document.getElementById("boEndless")) {
        currentBestOf = "Endless";
        theOtherBestOf1 = document.getElementById("bo3Div");
        theOtherBestOf2 = document.getElementById("bo5Div");
        theOtherBestOf3 = document.getElementById("boCrews");
        const winText = document.getElementsByClassName("winText");
        for (let i = 0; i < winText.length; i++) {
            winText[i].innerHTML = "Wins";
        }
    }

    //change the color and background of the buttons
    this.style.color = "var(--text1)";
    this.style.backgroundImage = "linear-gradient(to top, #575757, #00000000)";
    theOtherBestOf1.style.color = "var(--text2)";
    theOtherBestOf1.style.backgroundImage = "var(--bg4)";
    theOtherBestOf2.style.color = "var(--text2)";
    theOtherBestOf2.style.backgroundImage = "var(--bg4)";
    theOtherBestOf3.style.color = "var(--text2)";
    theOtherBestOf3.style.backgroundImage = "var(--bg4)";
}


function checkRound() {
    if (!forceWL.checked) {
        const wlButtons = document.getElementsByClassName("wlButtons");

        if (roundInp.value.toLocaleUpperCase().includes("Grand".toLocaleUpperCase())) {
            for (let i = 0; i < wlButtons.length; i++) {
                wlButtons[i].style.display = "inline";
            }
        } else {
            for (let i = 0; i < wlButtons.length; i++) {
                wlButtons[i].style.display = "none";
                deactivateWL();
            }
        }
    }
}

function applyNextInfo() {
    p1Name.value = p1NameNextInp.value;
    p2Name.value = p2NameNextInp.value;
    if (p1NameNextInp.value != "") {
        p1Name.value = p1NameNextInp.value
    }

    if (p2NameNextInp.value != "") {
        p2Name.value = p2NameNextInp.value
    }

    if (roundNextInp.value != "") {
        roundInp.value = roundNextInp.value
    }

    p1NameNextInp.value = "";
    p2NameNextInp.value = "";
    roundNextInp.value = "";

    scoreP1 = 0;
    p1Score.value = scoreP1;

    scoreP2 = 0;
    p2Score.value = scoreP2;
}


function swap() {
    let tempP1Name = p1NameInp.value;
    let tempP1Team = p1TagInp.value;
    let tempP2Name = p2NameInp.value;
    let tempP2Team = p2TagInp.value;
    let tempP1Pronouns = p1PronounsInp.value;
    let tempP2Pronouns = p2PronounsInp.value;

    p1NameInp.value = tempP2Name;
    p1TagInp.value = tempP2Team;
    p1PronounsInp.value = tempP2Pronouns;
    p2NameInp.value = tempP1Name;
    p2TagInp.value = tempP1Team;
    p2PronounsInp.value = tempP1Pronouns;

    changeInputWidth(p1NameInp);
    changeInputWidth(p1TagInp);
    changeInputWidth(p1PronounsInp);
    changeInputWidth(p2NameInp);
    changeInputWidth(p2TagInp);
    changeInputWidth(p2PronounsInp);

    let tempP1Char = charP1;
    let tempP2Char = charP2;
    let tempP1Skin = skinP1;
    let tempP2Skin = skinP2;

    changeCharacterManual(tempP2Char, 1);
    changeCharacterManual(tempP1Char, 2);
    charImgChange(charImgP1, charP1, tempP2Skin);
    charImgChange(charImgP2, charP2, tempP1Skin);

    skinP1 = tempP2Skin;
    skinP2 = tempP1Skin;

    tempP1Score = checkScore(p1Score);
    tempP2Score = checkScore(p2Score);
    setScore(tempP2Score, p1Score);
    setScore(tempP1Score, p2Score);
}

function swapNames() {
    let tempP1Name = p1NameInp.value;
    let tempP1Team = p1TagInp.value;
    let tempP2Name = p2NameInp.value;
    let tempP2Team = p2TagInp.value;
    let tempP1Pronouns = p1PronounsInp.value;
    let tempP2Pronouns = p2PronounsInp.value;

    p1NameInp.value = tempP2Name;
    p1TagInp.value = tempP2Team;
    p1PronounsInp.value = tempP2Pronouns;
    p2NameInp.value = tempP1Name;
    p2TagInp.value = tempP1Team;
    p2PronounsInp.value = tempP1Pronouns;

    changeInputWidth(p1NameInp);
    changeInputWidth(p1TagInp);
    changeInputWidth(p1PronounsInp);
    changeInputWidth(p2NameInp);
    changeInputWidth(p2TagInp);
    changeInputWidth(p2PronounsInp);

    writeScoreboard();
}

function swapScore() {
    tempP1Score = checkScore(p1Score);
    tempP2Score = checkScore(p2Score);
    setScore(tempP2Score, p1Score);
    setScore(tempP1Score, p2Score);
    writeScoreboard();
}

function clearPlayers() {
    //clear player texts
    p1PronounsInp.value = "";
    p1TagInp.value = "";
    p1NameInp.value = "";
    p2PronounsInp.value = "";
    p2TagInp.value = "";
    p2NameInp.value = "";
    changeInputWidth(p1PronounsInp);
    changeInputWidth(p1TagInp);
    changeInputWidth(p1NameInp);
    changeInputWidth(p2PronounsInp);
    changeInputWidth(p2TagInp);
    changeInputWidth(p2NameInp);

    //reset characters to random
    document.getElementById('p1CharSelector').setAttribute('src', charPath + '/CSS/Random.png');
    charP1 = "Random";
    skinP1 = "";
    charImgChange(charImgP1, charP1);
    document.getElementById('skinListP1').innerHTML = '';
    document.getElementById('skinListP1Sheik').innerHTML = '';
    document.getElementById('skinSelectorP1').style.opacity = 0;

    document.getElementById('p2CharSelector').setAttribute('src', charPath + '/CSS/Random.png');
    charP2 = "Random";
    skinP2 = "";
    charImgChange(charImgP2, charP2);
    document.getElementById('skinListP2').innerHTML = '';
    document.getElementById('skinListP2Sheik').innerHTML = '';
    document.getElementById('skinSelectorP2').style.opacity = 0;

    //clear player scores
    let checks = document.getElementsByClassName("scoreCheck");
    for (let i = 0; i < checks.length; i++) {
        checks[i].checked = false;
    }
}

function setScore(score, el) {
    el.value = score;
}


function forceWLtoggles() {
    const wlButtons = document.getElementsByClassName("wlButtons");

    if (forceWL.checked) {
        for (let i = 0; i < wlButtons.length; i++) {
            wlButtons[i].style.display = "inline";
        }
    } else {
        for (let i = 0; i < wlButtons.length; i++) {
            wlButtons[i].style.display = "none";
            deactivateWL();
        }
    }
}


//time to write it down
function writeScoreboard() {
    if (pgStats.checked) {
        if (previousName1 != p1NameInp.value || previousName2 != p2NameInp.value) {
            getPGInfo(p1NameInp.value, p2NameInp.value);
        }

        previousName1 = p1NameInp.value;
        previousName2 = p2NameInp.value;
    }

    let scoreboardJson = {
        p1Name: p1NameInp.value,
        p1Team: p1TagInp.value,
        p1Pronouns: p1PronounsInp.value,
        p1Character: charP1,
        p1Skin: skinP1,
        p1Color: colorP1,
        p1Score: checkScore(p1Score),
        p1WL: currentP1WL,
        p2Name: p2NameInp.value,
        p2Team: p2TagInp.value,
        p2Pronouns: p2PronounsInp.value,
        p2Character: charP2,
        p2Skin: skinP2,
        p2Color: colorP2,
        p2Score: checkScore(p2Score),
        p2WL: currentP2WL,
        round: roundInp.value,
        bestOf: currentBestOf,
        tournamentName: document.getElementById('tournamentName').value,
        caster1Name: document.getElementById('cName1').value,
        caster1Twitter: document.getElementById('cTwitter1').value,
        caster1Twitch: document.getElementById('cTwitch1').value,
        caster2Name: document.getElementById('cName2').value,
        caster2Twitter: document.getElementById('cTwitter2').value,
        caster2Twitch: document.getElementById('cTwitch2').value,
        allowIntro: document.getElementById('allowIntro').checked,
    };

    let data = JSON.stringify(scoreboardJson, null, 2);
    fs.writeFile(textPath + "/ScoreboardInfo.json", data, noop);

    let nextRound = '';

    if (roundNextInp.value == "") {
        nextRound = `${p1NameNextInp.value || "?"} vs ${p2NameNextInp.value || "?"}`;
    } else {
        nextRound = `${roundNextInp.value}`

        if (p1NameNextInp.value != "" || p2NameNextInp.value != "") {
            nextRound += ` \n${p1NameNextInp.value || "?"} vs ${p2NameNextInp.value || "?"}`;
        }
    }

    const texts = {
        p1Name: p1NameInp.value,
        p2Name: p2NameInp.value,
        p1Tag: p1TagInp.value,
        p2Tag: p2TagInp.value,
        p1Pronouns: p1PronounsInp.value,
        p2Pronouns: p2PronounsInp.value,
        round: roundInp.value,
        tournamentName: document.getElementById('tournamentName').value,
        caster1Name: document.getElementById('cName1').value,
        caster1Twitter: document.getElementById('cTwitter1').value,
        caster1Twitch: document.getElementById('cTwitch1').value,
        caster2Name: document.getElementById('cName2').value,
        caster2Twitter: document.getElementById('cTwitter2').value,
        caster2Twitch: document.getElementById('cTwitch2').value,
        scoreP1: scoreP1.toString(),
        scoreP2: scoreP2.toString(),
        setHistory,
        nextRound,
        currentBestOf
    }

    if (makeUppercase.checked || addSpace.checked) {
        for (let [key, value] of Object.entries(texts)) {
            value = makeUppercase.checked ? value.toUpperCase() : value;
            value = addSpace.checked ? value + " " : value;
            texts[key] = value;
        }
    }


    //simple .txt files
    fs.writeFile(textPath + "/Simple Texts/Player 1.txt", texts.p1Name, noop);
    fs.writeFile(textPath + "/Simple Texts/Player 2.txt", texts.p2Name, noop);

    fs.writeFile(textPath + "/Simple Texts/Player 1 Team.txt", texts.p1Tag, noop);
    fs.writeFile(textPath + "/Simple Texts/Player 2 Team.txt", texts.p2Tag, noop);

    fs.writeFile(textPath + "/Simple Texts/Player 1 Pronouns.txt", texts.p1Pronouns, noop);
    fs.writeFile(textPath + "/Simple Texts/Player 2 Pronouns.txt", texts.p2Pronouns, noop);

    fs.writeFile(textPath + "/Simple Texts/Round.txt", texts.round, noop);
    fs.writeFile(textPath + "/Simple Texts/Tournament Name.txt", texts.tournamentName, noop);

    fs.writeFile(textPath + "/Simple Texts/BestOf.txt", texts.currentBestOf, noop);

    fs.writeFile(textPath + "/Simple Texts/Caster 1 Name.txt", texts.caster1Name, noop);
    fs.writeFile(textPath + "/Simple Texts/Caster 1 Twitter.txt", texts.caster1Twitter, noop);
    fs.writeFile(textPath + "/Simple Texts/Caster 1 Twitch.txt", texts.caster1Twitch, noop);

    fs.writeFile(textPath + "/Simple Texts/Caster 2 Name.txt", texts.caster2Name, noop);
    fs.writeFile(textPath + "/Simple Texts/Caster 2 Twitter.txt", texts.caster2Twitter, noop);
    fs.writeFile(textPath + "/Simple Texts/Caster 2 Twitch.txt", texts.caster2Twitch, noop);

    fs.writeFile(textPath + "/Simple Texts/Player 1 Score.txt", texts.scoreP1, noop);
    fs.writeFile(textPath + "/Simple Texts/Player 2 Score.txt", texts.scoreP2, noop);

    fs.writeFile(textPath + "/Simple Texts/Set History.txt", texts.setHistory, noop);

    fs.writeFile(textPath + "/Simple Texts/Up Next.txt", texts.nextRound, noop);

    fs.copyFile(`${charPath}/Stock Icons/${charP1}/${skinP1}.png`, `${playerPath}/characterP1_icon.png`, () => {
        fs.utimesSync(`${playerPath}/characterP1_icon.png`, new Date(), new Date());
    });

    fs.copyFile(`${charPath}/Stock Icons/${charP2}/${skinP2}.png`, `${playerPath}/characterP2_icon.png`, () => {
        fs.utimesSync(`${playerPath}/characterP2_icon.png`, new Date(), new Date());
    });

    fs.copyFile(`${charPath}/Portraits/${charP1}/${skinP1}.png`, `${playerPath}/characterP1.png`, () => {
        fs.utimesSync(`${playerPath}/characterP1.png`, new Date(), new Date());
    });

    fs.copyFile(`${charPath}/Portraits/${charP2}/${skinP2}.png`, `${playerPath}/characterP2.png`, () => {
        fs.utimesSync(`${playerPath}/characterP2.png`, new Date(), new Date());
    });

    fs.copyFile(`${playerPath}/port${portP1}.png`, `${playerPath}/portP1.png`, () => {
        fs.utimesSync(`${playerPath}/portP1.png`, new Date(), new Date());
    });

    fs.copyFile(`${playerPath}/port${portP2}.png`, `${playerPath}/portP2.png`, () => {
        fs.utimesSync(`${playerPath}/portP2.png`, new Date(), new Date());
    });

    saveFieldValuesToStorage();
}

function updatePlayers(game) {
    handleSceneSwitch(sceneGameStartInp.value.split(','), sceneGameStartDelayInp.value.split(','));

    if (currentBestOf.toLowerCase() == "crews" && crewsNextRound != null) {
        roundInp.value = crewsNextRound;
        crewsNextRound = null;
    }

    player1Data = game.players[0];
    player2Data = game.players[1];

    if (portPrioSwapped) {
        [player1Data, player2Data] = [player2Data, player1Data];
    }

    charP1 = player1Data.characterName;
    skinP1 = player1Data.characterColor;
    portP1 = player1Data.port;

    charP2 = player2Data.characterName;
    skinP2 = player2Data.characterColor;
    portP2 = player2Data.port;

    charImgChange(charImgP1, player1Data.characterName, player1Data.characterColor);
    charImgChange(charImgP2, player2Data.characterName, player2Data.characterColor);

    updateColor(null, 1, player1Data.port);
    updateColor(null, 2, player2Data.port);

    if (p1Auto.checked) {
        if (player1Data.displayName != "") {
            p1NameInp.value = player1Data.displayName;
        }
    }

    if (p2Auto.checked) {
        if (player2Data.displayName != "") {
            p2NameInp.value = player2Data.displayName;
        }
    }

    if (!setStartTime || !setOfficiallyStarted) {
        setStartTime = new Date();
    }

    console.log("Updating players")

    writeScoreboard();
}

function updateScore(game) {

    setOfficiallyStarted = true;

    if (videoData != null) {
        if (!videoData.charsP1.includes(charP1)) {
            videoData.charsP1.push(charP1);
        }

        if (!videoData.charsP2.includes(charP2)) {
            videoData.charsP2.push(charP2);
        }
    } else {
        videoData = {
            charsP1: [charP1],
            charsP2: [charP2],
            charP1,
            charP2,
            skinP1,
            skinP2,
        }
    }

    player1Data = game.players[0];
    player2Data = game.players[1];

    if (portPrioSwapped) {
        [player1Data, player2Data] = [player2Data, player1Data];
    }

    if (currentBestOf.toLowerCase() == "crews") {
        let stocksP1 = game.data.stats.stocks.filter(stock => stock.playerIndex == player1Data.port - 1 && stock.endFrame != null).length;
        let stocksP2 = game.data.stats.stocks.filter(stock => stock.playerIndex == player2Data.port - 1 && stock.endFrame != null).length;

        scoreP1 = parseInt(scoreP1) - stocksP1;
        if (crewsStocksPlayer == 1) {
            scoreP1 += crewsStocksLeft
        }
        p1Score.value = scoreP1;

        scoreP2 = parseInt(scoreP2) - stocksP2;
        if (crewsStocksPlayer == 2) {
            scoreP2 += crewsStocksLeft
        }
        p2Score.value = scoreP2;

        if (player1Data.gameResult == "winner") {
            crewsStocksPlayer = 1;
            crewsStocksLeft = stocksP1;
        } else if (player2Data.gameResult == "winner") {
            crewsStocksPlayer = 2;
            crewsStocksLeft = stocksP2;
        }

        const round = roundInp.value;

        if (round.toLowerCase().startsWith('game')) {
            try {
                crewsNextRound = "Game " + (parseInt(round.split(' ')[1]) + 1);
            } catch (e) {
                //ignore
            }
        }
    } else {
        if (player1Data.gameResult == "winner") {
            giveWinP1()
        } else if (player2Data.gameResult == "winner") {
            giveWinP2()
        }
    }

    // Check if set has ended
    if (currentBestOf == "Best of 3") {
        if (scoreP1 >= 2 || scoreP2 >= 2) {
            onSetEnds()
        }
    } else if (currentBestOf == "Best of 5") {
        if (scoreP1 >= 3 || scoreP2 >= 3) {
            onSetEnds()
        }
    } else if (currentBestOf == "Crews") {
        if (scoreP1 <= 0 || scoreP2 <= 0) {
            onSetEnds()
        }
    }

    if (!setOfficiallyStarted) {
        // Set ended
        handleSceneSwitch(sceneSetEndInp.value.split(','), sceneSetEndDelayInp.value.split(','));
    } else {
        handleSceneSwitch(sceneGameEndInp.value.split(','), sceneGameEndDelayInp.value.split(','));
    }

    writeScoreboard();

}

function newSet(press) {
    setOfficiallyStarted = false;

    videoData = null

    if (press) {
        p1Score.value = 0;
        p2Score.value = 0;

        scoreP1 = p1Score.value;
        scoreP2 = p2Score.value;
        fetchSetDataFromStartGG();
    } else {
        setTimeout(() => {
            p1Score.value = 0;
            p2Score.value = 0;

            scoreP1 = p1Score.value;
            scoreP2 = p2Score.value;

            if (startggBracket != null) {
                fetchSetDataFromStartGG();
            }
        }, 5 * 1000);
    }
}

function onSetEnds() {
    if (nextAutoInp.checked) {
        setTimeout(() => {
            applyNextInfo()
        }, 5 * 1000);
    }

    if (videoData != null) {
        videoData.p1Name = p1NameInp.value;
        videoData.p2Name = p2NameInp.value;
        videoData.round = roundInp.value;
        videoData.tournamentName = document.getElementById('tournamentName').value;

        // Clone videoData to cachedVideoData
        cachedVideoData = JSON.parse(JSON.stringify(videoData));
        cachedVideoData.startTime = setStartTime;

        if (setVods.checked) {
            cutVideo();
        }
    }

    newSet();
}

async function getPGInfo(name1, name2) {
    try {
        setHistory = `? - ?`;
        if (name1 == "" || name2 == "") {
            return;
        }

        let playerProfile;
        let playerNumber;
        const dataP1 = await pgFetchSearch(name1);
        let dataP2;
        if (dataP1.result.length > 1) {
            dataP2 = await pgFetchSearch(name2);
            if (dataP2.result.length > 1) {
                if (dataP1.result.length < dataP2.result.length) {
                    playerProfile = findSpecificPlayer(name1, dataP1.result);
                    playerNumber = 1;
                } else {
                    playerProfile = findSpecificPlayer(name2, dataP2.result);
                    playerNumber = 2;
                }
            } else {
                playerProfile = dataP2.result[0];
                playerNumber = 2;
            }
        } else if (dataP1.result.length == 1) {
            playerProfile = dataP1.result[0];
            playerNumber = 1;
        } else {
            dataP2 = await pgFetchSearch(name2);
            if (dataP2.result.length > 1) {
                playerProfile = findSpecificPlayer(name2, dataP2.result);
                playerNumber = 2;
            } else if (dataP2.result.length == 1) {
                playerProfile = dataP2.result[0];
                playerNumber = 2;
            }
        }

        if (playerProfile == null) {
            setHistory = `? - ? `;

            fs.copyFileSync(`${playerPath}/unknown.png`, `${playerPath}/player1.png`);
            fs.utimesSync(`${playerPath}/player1.png`, new Date(), new Date());

            fs.copyFileSync(`${playerPath}/unknown.png`, `${playerPath}/player2.png`);
            fs.utimesSync(`${playerPath}/player2.png`, new Date(), new Date());

            return;
        }

        const opponents = await pgFetchOpponents(playerProfile.id);
        const opponentTag = playerNumber == 1 ? name2 : name1;
        let opponentId;

        for (const [key, value] of Object.entries(opponents.result)) {
            if (value.tag.toLowerCase() == opponentTag.toLowerCase()) {
                opponentId = key;
                break;
            }
        }

        let opponentProfile;

        if (opponentId != null) {
            opponentProfile = (await pgFetchPlayerProfile(opponentId)).result;
        } else {
            let dataOpponent = playerNumber == 1 ? dataP2 : dataP1;

            if (dataOpponent == null) {
                dataOpponent = await pgFetchSearch(playerNumber == 1 ? name2 : name1);
            }

            if (dataOpponent.result.length > 1) {
                opponentProfile = findSpecificPlayer(playerNumber == 1 ? name2 : name1, dataOpponent.result);
            } else {
                opponentProfile = dataOpponent.result[0];
            }
        }

        const p1Profile = playerNumber == 1 ? playerProfile : opponentProfile;
        const p2Profile = playerNumber == 2 ? playerProfile : opponentProfile;

        p1PronounsInp.value = p1Profile?.pronoun ?? p1PronounsInp.value;
        p2PronounsInp.value = p2Profile?.pronoun ?? p2PronounsInp.value;

        const p1Avatar = p1Profile?.images?.profile?.url;
        const p2Avatar = p2Profile?.images?.profile?.url;

        if (p1Avatar != null) {
            updateAvatar(p1Avatar, 1);
        } else {
            fs.copyFileSync(`${playerPath}/unknown.png`, `${playerPath}/player1.png`);
            fs.utimesSync(`${playerPath}/player1.png`, new Date(), new Date());
        }

        if (p2Avatar != null) {
            updateAvatar(p2Avatar, 2);
        } else {
            fs.copyFileSync(`${playerPath}/unknown.png`, `${playerPath}/player2.png`);
            fs.utimesSync(`${playerPath}/player2.png`, new Date(), new Date());
        }

        const playerData = await pgFetchPlayerData(playerProfile.id);

        let matches = 0;
        let wins = 0;

        for (const value of Object.values(playerData.result)) {
            for (const set of value.sets) {
                if (set.p1_score == -1 || set.p2_score == -1) {
                    continue;
                }

                if (set.p1_id == opponentId || set.p2_id == opponentId) {
                    matches++;
                    if (set.winner_id == playerProfile.id) {
                        wins++;
                    }
                }
            }
        }

        const winsP1 = playerNumber == 1 ? wins : matches - wins;
        const winsP2 = playerNumber == 2 ? wins : matches - wins;

        setHistory = `${winsP1} - ${winsP2}`;
        fs.writeFileSync(textPath + "/Simple Texts/Set History.txt", setHistory);
    } catch (error) {
        console.log(error);
        logError(`Error while fetching PGStats data: ${error.message}`);
    }
}

async function pgFetchSearch(name) {
    const response = await fetch("https://api.pgstats.com/players/search", {
        "headers": {
            "accept": "*/*",
            "cache-control": "no-cache",
            "content-type": "application/json",
            "token": ""
        },
        "referrer": "https://www.pgstats.com/",
        "referrerPolicy": "strict-origin-when-cross-origin",
        "body": JSON.stringify({ searchTerm: name, game: "melee", limit: 20, offset: 0, filters: {}, userId: "" }),
        "method": "POST",
        "mode": "cors",
        "credentials": "omit"
    });

    return await response.json();
}

async function pgFetchOpponents(playerId) {
    const response = await fetch(`https://api.pgstats.com/players/opponents?game=melee&playerId=${playerId}`);
    return await response.json();
}

async function pgFetchPlayerData(playerId) {
    const response = await fetch(`https://api.pgstats.com/players/data?playerId=${playerId}&game=melee`);
    return await response.json();
}

async function pgFetchPlayerProfile(playerId) {
    const response = await fetch(`https://api.pgstats.com/players/profile?playerId=${playerId}&game=melee`);
    return await response.json();
}

async function updateAvatar(url, player) {
    try {
        Jimp.read(url, (err, image) => {
            if (err) {
                fs.copyFileSync(`${playerPath}/unknown.png`, `${playerPath}/player${player}.png`);
                fs.utimesSync(`${playerPath}/player${player}.png`, new Date(), new Date());
                return;
            }

            const size = 300;

            // Determine the dimensions to scale the image to
            let scaleWidth = image.bitmap.width;
            let scaleHeight = image.bitmap.height;
            if (scaleWidth >= size && scaleHeight >= size) {
                // If both dimensions are greater than or equal to size pixels, resize the smallest dimension to size pixels
                if (scaleWidth < scaleHeight) {
                    scaleHeight = Math.round(scaleHeight * (size / scaleWidth));
                    scaleWidth = size;
                } else {
                    scaleWidth = Math.round(scaleWidth * (size / scaleHeight));
                    scaleHeight = size;
                }
            } else if (scaleWidth < size && scaleHeight < size) {
                // If both dimensions are smaller than size pixels, scale up to at least one dimension to size pixels
                if (scaleWidth < scaleHeight) {
                    scaleHeight = Math.round(scaleHeight * (size / scaleWidth));
                    scaleWidth = size;
                } else {
                    scaleWidth = Math.round(scaleWidth * (size / scaleHeight));
                    scaleHeight = size;
                }
            } else if (scaleWidth < size) {
                // If only the width is smaller than size pixels, scale up to size pixels width
                scaleWidth = size;
                scaleHeight = Math.round(scaleHeight * (size / scaleWidth));
            } else if (scaleHeight < size) {
                // If only the height is smaller than size pixels, scale up to size pixels height
                scaleWidth = Math.round(scaleWidth * (size / scaleHeight));
                scaleHeight = size;
            }

            // Resize the image to the scaled dimensions
            image.resize(scaleWidth, scaleHeight);

            // Crop the image to a final size of 300x300 by taking equal amounts from both sides if necessary
            if (scaleWidth > size) {
                const x = Math.max(0, (scaleWidth - size) / 2);
                image.crop(x, 0, size, scaleHeight);
            } else if (scaleHeight > size) {
                const y = Math.max(0, (scaleHeight - size) / 2);
                image.crop(0, y, scaleWidth, size);
            }

            // Save the image
            image.write(`${playerPath}/player${player}.png`);
        });
    } catch (err) {
        console.error(err);
        logError(`Error updating avatar for player ${player}: ${err}`);
        // ignore;
    }
}


function findSpecificPlayer(tag, data) {
    // Check for the player in the data array with the most recent matchDate property.
    const filtered = data.filter(d => d.tag.toLowerCase() === tag.toLowerCase());

    if (filtered.length == 0) {
        return filtered[0];
    }

    if (filtered.length > 0) {
        data = filtered;
    }

    return data.sort((d1, d2) => new Date(d2.latest_event_date) - new Date(d1.latest_event_date))[0];
}


const ffmpeg = require('fluent-ffmpeg');
const { start } = require('repl');

async function getDuration(path) {
    const creationTime = (await fs.promises.stat(path)).birthtimeMs;
    const currentTime = Date.now();
    const duration = (currentTime - creationTime) / 1000;
    return duration;
}

async function cutVideo() {
    if (obsRecordingPath == null || obsRecordingPath == "") {
        return;
    }

    try {

        // get now date minus setStartTime date
        const now = new Date().getTime();
        const setDuration = (now - cachedVideoData.startTime.getTime()) / 1000;

        // Get the video duration
        const videoDuration = await getDuration(obsRecordingPath);

        // Calculate the start time of the cut
        const startTime = videoDuration - setDuration;

        // Cut the video

        let pathString;
        if (currentBestOf.toLowerCase() == "crews") {
            pathString = `${cachedVideoData.p1Name} vs ${cachedVideoData.p2Name} - Crews - ${cachedVideoData.tournamentName}.mkv`;
        } else {
            pathString = `${cachedVideoData.p1Name} (${cachedVideoData.charsP1.join(', ')}) vs ${cachedVideoData.p2Name} (${cachedVideoData.charsP2.join(', ')}) - ${cachedVideoData.round} - ${cachedVideoData.tournamentName}.mkv`;
        }

        const outputDirectory = path.join(path.dirname(obsRecordingPath), 'Videos');

        if (!fs.existsSync(outputDirectory)) {
            // Create the directory recursively
            fs.mkdirSync(outputDirectory, { recursive: true });
        }

        const outputFilePath = path.join(outputDirectory, pathString);

        ffmpeg(obsRecordingPath)
            .outputOptions('-preset veryfast')
            .setStartTime(startTime - 15)
            .duration(setDuration + 30)
            .output(outputFilePath)
            .on('end', () => {
                console.log('Video cut successfully!');
            })
            .on('error', (error) => {
                console.error(`Error cutting video: ${error.message}`);
            })
            .run();

        createThumbnail();
    } catch (error) {
        console.error(`Error cutting video : ${error.message}`);
        logError(`Error cutting video : ${error.message}`);
    }
}

async function createThumbnail() {
    if (obsRecordingPath == null || obsRecordingPath == "") {
        return;
    }

    if (charP1 == "Random" || charP2 == "Random") {
        return;
    }

    if (cachedVideoData == null || cachedVideoData.charP1 == "Random" || cachedVideoData.charP2 == "Random") {
        cachedVideoData = {
            charsP1: [charP1],
            charsP2: [charP2],
            charP1,
            charP2,
            skinP1,
            skinP2,
            p1Name: p1NameInp.value,
            p2Name: p2NameInp.value,
            tournamentName: document.getElementById('tournamentName').value,
            round: roundInp.value,
        }
    }

    try {
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');

        char1Info = getTextJson("Thumbnail Info/" + cachedVideoData.charP1);
        char2Info = getTextJson("Thumbnail Info/" + cachedVideoData.charP2);

        const imgBackground = await loadImage(`${recordingsPath}/Thumbnails/background.png`);
        const imgVSMelee = await loadImage(`${recordingsPath}/Thumbnails/VS Melee.png`);

        const imgChar1 = await loadImage(`${charPath}/VS Screen/${cachedVideoData.charP1}/${cachedVideoData.skinP1} Left.png`);
        const imgChar2 = await loadImage(`${charPath}/VS Screen/${cachedVideoData.charP2}/${cachedVideoData.skinP2} Right.png`);

        ctx.drawImage(imgBackground, 0, 0);
        ctx.drawImage(imgVSMelee, 0, 0);
        ctx.drawImage(imgChar1, ((-imgChar1.width * char1Info.Left.scale) / 2) + 300 + char1Info.Left.x, ((-imgChar1.height * char1Info.Left.scale) / 2) + char1Info.Left.y, imgChar1.width * char1Info.Left.scale, imgChar1.height * char1Info.Left.scale);
        ctx.drawImage(imgChar2, 1920 + ((-imgChar2.width * char2Info.Right.scale) / 2) - 150 + char2Info.Right.x, ((-imgChar2.height * char2Info.Right.scale) / 2) + char2Info.Right.y, imgChar2.width * char2Info.Right.scale, imgChar2.height * char2Info.Right.scale);

        const fontData = getJson("Recordings/Thumbnails/font");

        const fontName = fontData.font.split('.')[0];

        const fontFace = new FontFace(fontName, `url('${process.env.DEV_ENV ? '../..' : rootPath.replace(/\\/g, '/')}/resources/Fonts/${fontData.font}')`);

        const font = await fontFace.load();
        document.fonts.add(font);
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 10;
        ctx.font = `${fontData.size}px ${fontName}`;

        // Draw text in center
        let text = cachedVideoData.tournamentName;
        let textWidth = ctx.measureText(text).width;
        ctx.strokeText(text, (canvas.width - textWidth) / 2, 100);
        ctx.fillText(text, (canvas.width - textWidth) / 2, 100);

        text = `${cachedVideoData.p1Name} VS ${cachedVideoData.p2Name}`;
        textWidth = ctx.measureText(text).width;
        ctx.strokeText(text, (canvas.width - textWidth) / 2, 1050);
        ctx.fillText(text, (canvas.width - textWidth) / 2, 1050);

        ctx.font = `${fontData.size * 0.777}px ${fontName}`;
        text = cachedVideoData.round;
        textWidth = ctx.measureText(text).width;
        ctx.strokeText(text, (canvas.width - textWidth) / 2, 230);
        ctx.fillText(text, (canvas.width - textWidth) / 2, 230);

        const url = canvas.toDataURL("image/png");
        let pathString;
        if (currentBestOf.toLowerCase() == "crews") {
            pathString = `${cachedVideoData.p1Name} vs ${cachedVideoData.p2Name} - Crews - ${cachedVideoData.tournamentName}.png`;
        } else {
            pathString = `${cachedVideoData.p1Name} (${cachedVideoData.charsP1.join(', ')}) vs ${cachedVideoData.p2Name} (${cachedVideoData.charsP2.join(', ')}) - ${cachedVideoData.round} - ${cachedVideoData.tournamentName}.png`;
        }

        const outputDirectory = path.join(path.dirname(obsRecordingPath), 'Videos');

        if (!fs.existsSync(outputDirectory)) {
            // Create the directory recursively
            fs.mkdirSync(outputDirectory, { recursive: true });
        }

        const outputFilePath = path.join(outputDirectory, pathString);

        const base64Data = url.replace(/^data:image\/png;base64,/, "");
        fs.writeFileSync(outputFilePath, base64Data, 'base64');
    } catch (error) {
        console.error(`Error creating thumbnail: ${error.message}`);
        logError(`Error creating thumbnail: ${error.message}`);
    }
}

async function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = reject;
    });
}

async function createReplay(button) {
    if (!button && !document.getElementById('replayAuto').checked) {
        return;
    }

    try {
        if (obsRecordingPath == null || obsRecordingPath == '') {
            console.log("No recording path set");
            return;
        }

        // get now date minus setStartTime date
        const duration = document.getElementById('replayDuration').value || 10;

        // Get the video duration
        const videoDuration = await getDuration(obsRecordingPath);

        // Calculate the start time of the cut
        const startTime = videoDuration - duration;

        const outputDirectory = path.join(path.dirname(obsRecordingPath), 'Replays');

        if (!fs.existsSync(outputDirectory)) {
            // Create the directory recursively
            fs.mkdirSync(outputDirectory, { recursive: true });
        }

        const outputFilePath = path.join(outputDirectory, `Replay ${new Date().toISOString().slice(0, 19).replace(/:/g, "-").replace('T', ' ')}.mkv`);

        // Cut the video
        ffmpeg(obsRecordingPath)
            .outputOptions('-preset veryfast')
            .setStartTime(startTime)
            .duration(duration)
            .output(outputFilePath)
            .on('end', () => {
                console.log('Made replay successfully!');
                if (document.getElementById('replayShort').checked) {
                    createShort(outputFilePath, true);
                }
            })
            .on('error', (error) => {
                console.error(`Error cutting video: ${error.message}`);
            })
            .run();
    } catch (error) {
        logError(`Error creating replay: ${error.message}`);
        console.error(`Error getting video duration: ${error.message}`);
    }
}

async function fetchSetDataFromStartGG(fromButton) {
    try {
        if (!startggOn && !fromButton) {
            return;
        }

        if (!startggBracket) {
            return;
        }

        const data = await fetch(startggBracket, {
            cache: 'no-cache',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const htmlString = await data.text();

        const parser = new DOMParser();
        const htmlDoc = parser.parseFromString(htmlString, 'text/html');

        const element = htmlDoc.querySelector('.match.in-progress .fa-twitch');
        if (element == null) {
            if (startggTimeout != null) {
                clearTimeout(startggTimeout);
            }

            if (startggOn) {
                startggTimeout = setTimeout(() => {
                    fetchSetDataFromStartGG();
                }, 10000);
            }
            return;
        }

        const parent = element.parentNode.parentNode.parentNode.parentNode.parentNode.parentNode;

        const player1Container = parent.querySelector('.match-section-top .match-player-name-container');

        let player1, tag1

        if (player1Container != null) {
            tag1 = player1Container.querySelector('.prefix')?.textContent.trim() || '';
            player1 = player1Container.textContent.replace(tag1, '').trim();
        } else {
            player1 = parent.querySelector('.match-section-top .match-player-name').textContent.trim();
            tag1 = '';
        }

        const player2Container = parent.querySelector('.match-section-bottom .match-player-name-container');

        let player2, tag2

        if (player2Container != null) {
            tag2 = player2Container.querySelector('.prefix')?.textContent.trim() || '';
            player2 = player2Container.textContent.replace(tag2, '').trim();
        } else {
            player2 = parent.querySelector('.match-section-bottom .match-player-name').textContent.trim();
            tag2 = '';
        }

        if ((player1 == null || player2 == null) || (player1 == previousStartggP1 && player2 == previousStartggP2 && !fromButton)) {
            if (startggTimeout != null) {
                clearTimeout(startggTimeout);
            }

            if (startggOn) {
                startggTimeout = setTimeout(() => {
                    fetchSetDataFromStartGG();
                }, 10000);
            }

            return;
        }

        p1NameInp.value = player1;
        p2NameInp.value = player2;

        p1TagInp.value = tag1;
        p2TagInp.value = tag2;

        previousStartggP1 = player1;
        previousStartggP2 = player2;

        // Determine the round
        const left = parent.style.left.replace('px', '')
        const roundIndex = Math.floor(left / 204);
        const roundElements = parent.parentNode.previousElementSibling.children;
        const roundElement = roundElements[roundIndex];

        const roundName = roundElement.querySelector('[class^="title-"]').textContent.trim();

        roundInp.value = roundName;

        writeScoreboard();
    } catch (error) {
        console.error(`Error fetching data from start.gg: ${error.message}`);
        logError(`Error fetching data from start.gg: ${error.message}`);
    }
}

async function toggleStartgg(v) {
    startggOn = v.checked
    if (!startggOn) {
        if (startggTimeout != null) {
            clearTimeout(startggTimeout);
        }
    } else {
        fetchSetDataFromStartGG();
    }
}

async function swapPortPrio(v) {
    portPrioSwapped = v.checked;

    if (player1Data == null || player2Data == null) {
        return;
    }

    [player1Data, player2Data] = [player2Data, player1Data];

    charP1 = player1Data.characterName;
    skinP1 = player1Data.characterColor;
    portP1 = player1Data.port;

    charP2 = player2Data.characterName;
    skinP2 = player2Data.characterColor;
    portP2 = player2Data.port;

    charImgChange(charImgP1, player1Data.characterName, player1Data.characterColor);
    charImgChange(charImgP2, player2Data.characterName, player2Data.characterColor);

    updateColor(null, 1, player1Data.port);
    updateColor(null, 2, player2Data.port);

    writeScoreboard();
}

async function handleSceneSwitch(scenes, delays) {
    try {
        if (!obsConnected) {
            return;
        }

        if (!autoSwitchScenes.checked) {
            return;
        }

        if (sceneSwitchTimeout) {
            clearTimeout(sceneSwitchTimeout);
            sceneSwitchTimeout = null;
        }

        if (scenes.length == 0 || scenes[0] == '') {
            return;
        }

        const scene = scenes[0].trim();
        const delay = delays[0];

        if (delay == null || delay == '') {
            obs.call('SetCurrentProgramScene', { 'sceneName': scene })
            handleSceneSwitch(scenes.slice(1), delays.slice(1));
        } else {
            const delayFloat = parseFloat(delay);

            if (isNaN(delayFloat)) {
                obs.call('SetCurrentProgramScene', { 'sceneName': scene })
                handleSceneSwitch(scenes.slice(1), delays.slice(1));
                return;
            }

            sceneSwitchTimeout = setTimeout(() => {
                obs.call('SetCurrentProgramScene', { 'sceneName': scene })
                handleSceneSwitch(scenes.slice(1), delays.slice(1));
            }, delayFloat * 1000);
        }
    } catch (error) {
        console.error(`Error switching scenes: ${error.message}`);
        logError(`Error switching scenes: ${error.message}`);
    }
}

async function onAutoSceneSwitchCheck() {
    if (!obsConnected) {
        return;
    }

    document.getElementById("sceneGameStart").disabled = !autoSwitchScenes.checked;
    document.getElementById("sceneGameStartDelay").disabled = !autoSwitchScenes.checked;
    document.getElementById("sceneGameEnd").disabled = !autoSwitchScenes.checked;
    document.getElementById("sceneGameEndDelay").disabled = !autoSwitchScenes.checked;
    document.getElementById("sceneSetEnd").disabled = !autoSwitchScenes.checked;
    document.getElementById("sceneSetEndDelay").disabled = !autoSwitchScenes.checked;
}

async function connectToOBS() {
    if (obsPasswordInp.value == null || obsPasswordInp.value == '') {
        obs.connect(`ws://${obsURLInp.value || '127.0.0.01'}:${obsPortInp.value || '4455'}`);
    } else {
        obs.connect(`ws://${obsURLInp.value || '127.0.0.01'}:${obsPortInp.value || '4455'}`, obsPasswordInp.value);
    }
}

function getVideoDuration(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (error, metadata) => {
            if (error) {
                reject(error);
                return;
            }
            const duration = metadata.format.duration;
            resolve(duration);
        });
    });
}

async function createShort(input, auto) {
    try {
        const data = await getJson("Recordings/Shorts/coordinates");

        const duration = await getVideoDuration(input);

        if (duration == "N/A") {
            return;
        }

        const filename = path.parse(input).name.replace('Replay', '');

        let directory

        if (auto) {
            directory = path.join(path.dirname(input), '..', 'Shorts')
        } else {
            directory = path.join(path.dirname(input))
        }

        if (!fs.existsSync(directory)) {
            // Create the directory recursively
            fs.mkdirSync(directory, { recursive: true });
        }

        // Output file paths
        const centerOutput = path.join(directory, `${filename}_center.mkv`);
        const leftOutput = path.join(directory, `${filename}_left.mkv`);
        const leftScaledOutput = path.join(directory, `${filename}_left_scaled.mkv`);
        const rightOutput = path.join(directory, `${filename}_right.mkv`);
        const rightScaledOutput = path.join(directory, `${filename}_right_scaled.mkv`);
        const finalOutput = path.join(directory, `Short ${filename}.mkv`);

        data.center.x = data.center.left;
        data.center.y = data.center.top;
        data.center.w = data.center.right - data.center.left;
        data.center.w = data.center.bottom - data.center.top;

        data.left.x = data.left.left;
        data.left.y = data.left.top;
        data.left.w = data.left.right - data.left.left;
        data.left.h = data.left.bottom - data.left.top;

        data.right.x = data.right.left;
        data.right.y = data.right.top;
        data.right.w = data.right.right - data.right.left;
        data.right.h = data.right.bottom - data.right.top;

        // Step 1: Crop center portion
        ffmpeg(input)
            .output(centerOutput)
            .videoFilter(`crop = ${data.center.w}: ${data.center.h}: ${data.center.x}: ${data.center.y}`)
            .on('end', () => {
                // Step 2: Crop left portion
                ffmpeg(input)
                    .output(leftOutput)
                    .videoFilter(`crop = ${data.left.w}: ${data.left.h}: ${data.left.x}: ${data.left.y}`)
                    .on('end', () => {
                        // Step 3: Crop right portion
                        ffmpeg(input)
                            .output(rightOutput)
                            .videoFilter(`crop = ${data.right.w}: ${data.right.h}: ${data.right.x}: ${data.right.y}`)
                            .on('end', () => {

                                let height = Math.floor(data.center.w * 16 / 9);
                                if (height % 2 == 1) {
                                    height += 1;
                                }

                                const scaleFactor = height - data.center.h;

                                let leftScaledWidth, leftScaledHeight, rightScaledWidth, rightScaledHeight;

                                if (data.scaleVertical) {
                                    leftScaledWidth = Math.floor(data.left.w * scaleFactor / data.left.h);
                                    leftScaledHeight = scaleFactor;
                                } else {
                                    leftScaledWidth = data.center.w / 2
                                    leftScaledHeight = (leftScaledWidth * data.left.h) / data.left.w;
                                }

                                if (leftScaledWidth % 2 == 1) {
                                    leftScaledWidth += 1;
                                }

                                if (leftScaledHeight % 2 == 1) {
                                    leftScaledHeight += 1;
                                }

                                ffmpeg(leftOutput)
                                    .output(leftScaledOutput)
                                    .videoFilter(`scale = ${leftScaledWidth}: ${leftScaledHeight}`)
                                    .on('error', function (err, stdout, stderr) {
                                        if (err) {
                                            console.log(err.message);
                                            console.log("stdout:\n" + stdout);
                                            console.log("stderr:\n" + stderr);
                                            reject("Error");
                                        }
                                    })
                                    .on('end', () => {

                                        if (data.scaleVertical) {
                                            rightScaledWidth = Math.floor(data.right.w * scaleFactor / data.right.h);
                                            rightScaledHeight = scaleFactor;
                                        } else {
                                            rightScaledWidth = data.center.w / 2
                                            rightScaledHeight = (rightScaledWidth * data.right.h) / data.left.w;
                                        }

                                        if (rightScaledWidth % 2 == 1) {
                                            rightScaledWidth += 1;
                                        }

                                        if (rightScaledHeight % 2 == 1) {
                                            rightScaledHeight += 1;
                                        }

                                        ffmpeg(rightOutput)
                                            .output(rightScaledOutput)
                                            .videoFilter(`scale = ${rightScaledWidth}: ${rightScaledHeight}`)
                                            .on('end', () => {

                                                // Step 4: Stack all three videos
                                                ffmpeg()
                                                    .input(centerOutput)
                                                    .input(leftScaledOutput)
                                                    .input(rightScaledOutput)
                                                    .complexFilter(
                                                        [
                                                            `[0: v]pad = iw: ${height}[int]`,
                                                            `[int][1: v]overlay = 0: ${data.center.h}[left]`,
                                                            `[left][2: v]overlay = W - ${rightScaledWidth}: ${data.center.h}[stacked]`,
                                                        ],
                                                        'stacked'
                                                    )
                                                    .output(finalOutput)
                                                    .outputOptions([
                                                        '-map', '0:a',              // Map the audio stream from the first input
                                                        '-c:a', 'copy'              // Copy the audio codec
                                                    ])
                                                    .on('end', () => {
                                                        console.log('Process completed successfully.');

                                                        fs.unlink(centerOutput, noop);
                                                        fs.unlink(leftOutput, noop);
                                                        fs.unlink(leftScaledOutput, noop);
                                                        fs.unlink(rightOutput, noop);
                                                        fs.unlink(rightScaledOutput, noop);
                                                    })
                                                    .run();
                                            }).run();
                                    }).run();
                            }).run();
                    }).run();
            }).run()
    } catch (error) {
        console.log(error);
        logError(`Error creating short: ${error.message}`);
    }
}

restoreFieldValuesFromStorage();