'use strict';

const app = require('app');
const midi = require('midi');

const input = new midi.input();
const output = new midi.output();

const vInput = new midi.input();
const vOutput = new midi.output();

const MIDI_NOTE_ON = 0x90;
const MIDI_NOTE_OFF = 0x80;
const MIDI_CC = 0xB0;

const MIDI_MIX_SOLO = 0x1B;
const MIDI_MIX_BANK_LEFT = 0x19;
const MIDI_MIX_BANK_RIGHT = 0x1A;

let currentBank = 0;

function closeMidiPorts() {
  input.closePort();
  output.closePort();
  vInput.closePort();
  vOutput.closePort();
}

function getMidiMixPort(input) {
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

//------------------------------------------------------------------------------
function handleMixMidiNoteOn(message) {
  console.log("note on: " + message[1]);
  switch (message[1]) {
  case MIDI_MIX_SOLO:
    break;

  case MIDI_MIX_BANK_LEFT:
    if (currentBank > 0) {
      currentBank--;
      console.log("switching to previous bank: " + currentBank);
    }
    break;

  case MIDI_MIX_BANK_RIGHT:
    if (currentBank < 0xF) {
      currentBank++;
      console.log("switchting to next bank: " + currentBank);
    }
    break;

  default:
    if (message[1] >= 0x1 && message[1] <= 0x18) {
      let column = (message[1] - 1) / 3;
      let fn = (message[1] - 1) % 3;
      console.log("column: " + column + " fn: " + fn);
    }
    break;
  }
}

function handleMixMidiNoteOff(message) {
  console.log("note off: " + message[1]);
}

function handleMixMidiCC(message) {
  // forward to the current channel
  vOutput.sendMessage([MIDI_CC | currentBank, message[1], message[2]]);
}

//------------------------------------------------------------------------------
function handleVirtualMidiNoteOn(message) {
}

function handleVirtualMidiNoteOff(message) {
}

function handleVirtualMidiCC(message) {
  let channel = message[0] & 0xF;
  if (channel === currentBank) {
    // forward to the current channel
    output.sendMessage([MIDI_CC, message[1], message[2]]);
  }
}

//------------------------------------------------------------------------------
function setupMidiFilter(input, handleMidiNoteOn, handleMidiNoteOff, handleMidiCC) {
  input.on('message', function (deltaTime, message) {
    switch (message[0] & 0xF0) {
    case MIDI_NOTE_ON:
      handleMidiNoteOn(message);
      break;

    case MIDI_NOTE_OFF:
      handleMidiNoteOff(message);
      break;

    case MIDI_CC:
      handleMidiCC(message);
      break;

    default:
      console.log("ignoring message: " + message);
      break;
    }

  });
}

function setupMidiMixFilter() {
  let midiMixInputPortIdx = getMidiMixPort(input);
  let midiMixOutputPortIdx = getMidiMixPort(output);
  if (midiMixInputPortIdx === undefined || midiMixOutputPortIdx === undefined) {
    console.log("Could not find MIDI mix");
    return false;
  }

  setupMidiFilter(input, handleMixMidiNoteOn, handleMixMidiNoteOff, handleMixMidiCC);
  setupMidiFilter(vInput, handleVirtualMidiNoteOn, handleVirtualMidiNoteOff, handleVirtualMidiCC);

  input.openPort(midiMixInputPortIdx);
  output.openPort(midiMixOutputPortIdx);
  vInput.openVirtualPort("MIDIMix Filter");
  vOutput.openVirtualPort("MIDIMix Filter");

  return true;
}


app.on('ready', function () {
  if (!setupMidiMixFilter()) {
    app.quit();
  }
});

app.on('quit', function () {
  console.log("quit");
  closeMidiPorts();
});
