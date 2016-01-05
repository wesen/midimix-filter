'use strict';

const app = require('app');
const midi = require('midi');

const input = new midi.input();

let currentBank = 0;

function getMidiMixPort() {
  let cnt = input.getPortCount();
  for (var i = 0; i < cnt; i++) {
    let name = input.getPortName(i);
    console.log("midi port " + i + ": " + name);
    if (name === "MIDI Mix") {
      return i;
    }
  }

  return undefined;
}

app.on('ready', function () {
  let midiMixPortIdx = getMidiMixPort();
  if (midiMixPortIdx === undefined) {
    console.log("Could not find MIDI mix");
    app.quit();
  }
});

app.on('quit', function () {
  console.log("quit");
});
