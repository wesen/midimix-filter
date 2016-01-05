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

const MIDI_MIX_MUTE_ROW = 0;
const MIDI_MIX_SOLO_ROW = 1;
const MIDI_MIX_REC_ROW = 2;

let currentBank = 0;
let muteButtonStatus = [0, 0, 0, 0, 0, 0, 0, 0];
let recButtonStatus = [0, 0, 0, 0, 0, 0, 0, 0];

function closeMidiPorts() {
  input.closePort();
  output.closePort();
  vInput.closePort();
  vOutput.closePort();
}

function findMidiPort(input, inputName) {
  let cnt = input.getPortCount();
  for (let i = 0; i < cnt; i++) {
    let name = input.getPortName(i);
    console.log("midi port " + i + ": " + name + " inputName: " + inputName);
    if (name === inputName) {
      return i;
    }
  }

  return undefined;
}

//------------------------------------------------------------------------------
function makeSingleButtonRow(idx) {
  let array = [0, 0, 0, 0, 0, 0, 0, 0];
  array[idx] = 1;
  return array;
}

function setSingleButton(row, idx) {
  sendButtonStatus(row, makeSingleButtonRow(idx));
}

function sendButtonStatus(row, status) {
  for (let i = 0; i < status.length; i++) {
    output.sendMessage([status[i] ? MIDI_NOTE_ON : MIDI_NOTE_ON, i * 3 + row + 1, status[i] ? 127 : 0]);
  }
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
    setSingleButton(MIDI_MIX_MUTE_ROW, currentBank);
    break;

  case MIDI_MIX_BANK_RIGHT:
    if (currentBank < 0xF) {
      currentBank++;
      console.log("switchting to next bank: " + currentBank);
    }
    setSingleButton(MIDI_MIX_MUTE_ROW, currentBank);
    break;

  default:
    if (message[1] >= 0x1 && message[1] <= 0x18) {
      let column = Math.round((message[1] - 1) / 3);
      let fn = (message[1] - 1) % 3;
      console.log("column: " + column + " fn: " + fn);

      vOutput.sendMessage([MIDI_NOTE_ON | currentBank, message[1], message[2]]);
      output.sendMessage([MIDI_NOTE_ON, message[1], message[2]]);
      switch (fn) {
      case MIDI_MIX_MUTE_ROW:
        muteButtonStatus[column] = 1;
        break;

      case MIDI_MIX_REC_ROW:
        recButtonStatus[column] = 1;
        break;

      default:
        break;
      }
    }

    break;
  }
}

function handleMixMidiNoteOff(message) {
  console.log("note off: " + message[1]);
  switch (message[1]) {
  case MIDI_MIX_SOLO:
    break;

  case MIDI_MIX_BANK_LEFT:
    sendButtonStatus(MIDI_MIX_MUTE_ROW, muteButtonStatus);
    break;

  case MIDI_MIX_BANK_RIGHT:
    sendButtonStatus(MIDI_MIX_MUTE_ROW, muteButtonStatus);
    break;

  default:
    if (message[1] >= 0x1 && message[1] <= 0x18) {
      let column = Math.round((message[1] - 1) / 3);
      let fn = (message[1] - 1) % 3;
      console.log("column: " + column + " fn: " + fn);

      vOutput.sendMessage([MIDI_NOTE_OFF | currentBank, message[1], message[2]]);
      output.sendMessage([MIDI_NOTE_ON, message[1], 0]);
      switch (fn) {
      case MIDI_MIX_MUTE_ROW:
        muteButtonStatus[column] = 0;
        break;

      case MIDI_MIX_REC_ROW:
        recButtonStatus[column] = 0;
        break;

      default:
        break;
      }
    }
    break;
  }
}

function handleMixMidiCC(message) {
  // forward to the current channel
  vOutput.sendMessage([MIDI_CC | currentBank, message[1], message[2]]);
}

//------------------------------------------------------------------------------
function handleVirtualMidiNoteOn(message) {
  let channel = message[0] & 0xF;
  if (channel !== currentBank) {
    return;
  }

  if (message[1] >= 0x1 && message[1] <= 0x18) {
    let column = Math.round((message[1] - 1) / 3);
    let fn = (message[1] - 1) % 3;
    console.log("column: " + column + " fn: " + fn);

    output.sendMessage([MIDI_NOTE_ON, message[1], message[2]]);
    switch (fn) {
    case MIDI_MIX_MUTE_ROW:
      muteButtonStatus[column] = message[2] === 0 ? 0 : 1;
      break;

    case MIDI_MIX_REC_ROW:
      recButtonStatus[column] = message[2] === 0 ? 0 : 1;
      break;

    default:
      break;
    }
  }
}

function handleVirtualMidiNoteOff(message) {
  if (channel !== currentBank) {
    return;
  }

  if (message[1] >= 0x1 && message[1] <= 0x18) {
    let column = Math.round((message[1] - 1) / 3);
    let fn = (message[1] - 1) % 3;
    console.log("column: " + column + " fn: " + fn);

    output.sendMessage([MIDI_NOTE_ON, message[1], 0]);
    switch (fn) {
    case MIDI_MIX_MUTE_ROW:
      muteButtonStatus[column] = 0;
      break;

    case MIDI_MIX_REC_ROW:
      recButtonStatus[column] = 0;
      break;

    default:
      break;
    }
  }

}

function handleVirtualMidiCC(message) {
  let channel = message[0] & 0xF;
  console.log("midi cc on channel: " + channel);
  if (channel === currentBank) {
    // forward to the current channel
    output.sendMessage([MIDI_CC, message[1], message[2]]);
  }
}

//------------------------------------------------------------------------------
function setupMidiFilter(input, handleMidiNoteOn, handleMidiNoteOff, handleMidiCC) {
  input.on('message', (deltaTime, message) => {
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
  let midiMixInputPortIdx = findMidiPort(input, "MIDI Mix");
  let midiMixOutputPortIdx = findMidiPort(output, "MIDI Mix");
  if (midiMixInputPortIdx === undefined || midiMixOutputPortIdx === undefined) {
    console.log("Could not find MIDI mix");
    return false;
  }

  setupMidiFilter(input, handleMixMidiNoteOn, handleMixMidiNoteOff, handleMixMidiCC);
  setupMidiFilter(vInput, handleVirtualMidiNoteOn, handleVirtualMidiNoteOff, handleVirtualMidiCC);

  input.openPort(midiMixInputPortIdx);
  output.openPort(midiMixOutputPortIdx);

  // disable the virtual port functionality for now, as it is not practical to debug
  if (false) {
    vInput.openVirtualPort("MIDIMix Filter");
    vOutput.openVirtualPort("MIDIMix Filter");
  } else {
    let reaktorInputPortIdx = findMidiPort(vInput, "Reaktor 6 Virtual Output");
    let reaktorOutputPortIdx = findMidiPort(vOutput, "Reaktor 6 Virtual Input");
    if (reaktorInputPortIdx === undefined || reaktorOutputPortIdx === undefined) {
      console.log("Could not find Reaktor virtual port");
      return false;
    }
    vInput.openPort(reaktorInputPortIdx);
    vOutput.openPort(reaktorOutputPortIdx);

    sendButtonStatus(0, muteButtonStatus);
    sendButtonStatus(2, recButtonStatus);
  }

  return true;
}


app.on('ready', () => {
  if (!setupMidiMixFilter()) {
    app.quit();
  }
});

app.on('quit', () => {
  console.log("quit");
  closeMidiPorts();
});
