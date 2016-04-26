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
const MIDI_SYSEX_START = 0xF0;
const MIDI_SYSEX_STOP = 0xF7;

const MIDI_TE_ID = [0x00, 0x20, 0x76];

const MIDI_ID_SEQUENCE = [MIDI_SYSEX_START, 0x7e, 0x7f, 0x06, 0x01, MIDI_SYSEX_STOP];

const OP1_ENABLE_SEQUENCE = [0x00, 0x01, 0x02];
const OP1_DISABLE_SEQUENCE = [0x00, 0x01, 0x00];
const OP1_TEXT_START_SEQUENCE = [0x00, 0x03];
const OP1_TEXT_COLOR_START_SEQUENCE = [0x00, 0x04];

function sendOp1Sequence(output, sequence) {
  return output.sendMessage([MIDI_SYSEX_START].concat(MIDI_TE_ID).concat(sequence).concat([MIDI_SYSEX_STOP]));
}

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
  switch (message[1]) {
  case MIDI_MIX_BANK_LEFT:
    if (currentBank > 0) {
      currentBank--;
    }
    setSingleButton(MIDI_MIX_MUTE_ROW, currentBank);
    break;

  case MIDI_MIX_BANK_RIGHT:
    if (currentBank < 0xF) {
      currentBank++;
    }
    setSingleButton(MIDI_MIX_MUTE_ROW, currentBank);
    break;

  case MIDI_MIX_SOLO:
    mixSoloPressed = true;
    break;

  default:
    if (message[1] >= 0x1 && message[1] <= 0x18) {
      let column = Math.round((message[1] - 1) / 3);
      let fn = (message[1] - 1) % 3;

      switch (fn) {
      case MIDI_MIX_MUTE_ROW:
        vOutput.sendMessage([MIDI_CC | currentBank, MIDI_MIX_MUTE_CC_START + column, 127]);
        muteButtonStatus[currentBank][column] = 1;
        break;

      case MIDI_MIX_REC_ROW:
        vOutput.sendMessage([MIDI_CC | currentBank, MIDI_MIX_REC_CC_START + column, 127]);
        recButtonStatus[currentBank][column] = 1;
        break;

      case MIDI_MIX_SOLO_ROW:
        vOutput.sendMessage([MIDI_CC | currentBank, MIDI_MIX_SOLO_CC_START + column, 127]);
        soloButtonStatus[currentBank][column] = 1;
        break;

      default:
        break;
      }
    }

    break;
  }
}

function handleMixMidiNoteOff(message) {
  switch (message[1]) {
  case MIDI_MIX_SOLO:
    mixSoloPressed = false;
    break;

  case MIDI_MIX_BANK_LEFT:
    sendButtonStatus(MIDI_MIX_MUTE_ROW, muteButtonStatus[currentBank]);
    sendButtonStatus(MIDI_MIX_REC_ROW, recButtonStatus[currentBank]);
    break;

  case MIDI_MIX_BANK_RIGHT:
    sendButtonStatus(MIDI_MIX_MUTE_ROW, muteButtonStatus[currentBank]);
    sendButtonStatus(MIDI_MIX_REC_ROW, recButtonStatus[currentBank]);
    break;

  default:
    if (message[1] >= 0x1 && message[1] <= 0x18) {
      let column = Math.round((message[1] - 1) / 3);
      let fn = (message[1] - 1) % 3;

      switch (fn) {
      case MIDI_MIX_MUTE_ROW:
        muteButtonStatus[currentBank][column] = 0;
        vOutput.sendMessage([MIDI_CC | currentBank, MIDI_MIX_MUTE_CC_START + column, 0]);
        break;

      case MIDI_MIX_REC_ROW:
        recButtonStatus[currentBank][column] = 0;
        vOutput.sendMessage([MIDI_CC | currentBank, MIDI_MIX_REC_CC_START + column, 0]);
        break;

      case MIDI_MIX_SOLO_ROW:
        soloButtonStatus[currentBank][column] = 0;
        vOutput.sendMessage([MIDI_CC | currentBank, MIDI_MIX_SOLO_CC_START + column, 0]);
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
  if (mixSoloPressed) {
    vOutput.sendMessage([MIDI_CC | currentBank, message[1] + 64, message[2]]);
  } else {
    vOutput.sendMessage([MIDI_CC | currentBank, message[1], message[2]]);
  }
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
  }
}

function handleVirtualMidiNoteOff(message) {
  if (channel !== currentBank) {
    return;
  }

  // ignore notes
}

function handleVirtualMidiCC(message) {
  let channel = message[0] & 0xF;
  if (channel === currentBank) {
    // forward to the current channel
    if (message[1] >= MIDI_MIX_MUTE_CC_START && message[1] <= (MIDI_MIX_MUTE_CC_START + 8)) {
      // map to mute buttons
      let col = message[1] - MIDI_MIX_MUTE_CC_START;
      muteButtonStatus[currentBank][col] = message[2] >= 64 ? 1 : 0;
      output.sendMessage([MIDI_NOTE_ON, col * 3 + MIDI_MIX_MUTE_ROW + 1, message[2] >= 64 ? 127 : 0]);
    } else if (message[1] >= MIDI_MIX_REC_CC_START && message[1] <= (MIDI_MIX_REC_CC_START + 8)) {
      let col = message[1] - MIDI_MIX_REC_CC_START;
      recButtonStatus[currentBank][col] = message[2] >= 64 ? 1 : 0;
      output.sendMessage([MIDI_NOTE_ON, col * 3 + MIDI_MIX_REC_ROW + 1, message[2] >= 64 ? 127 : 0]);
    } else if (message[1] >= MIDI_MIX_SOLO_CC_START && message[1] <= (MIDI_MIX_SOLO_CC_START + 8)) {
      let col = message[1] - MIDI_MIX_SOLO_CC_START;
      soloButtonStatus[currentBank][col] = message[2] >= 64 ? 1 : 0;
      output.sendMessage([MIDI_NOTE_ON, col * 3 + MIDI_MIX_SOLO_ROW + 1, message[2] >= 64 ? 127 : 0]);
    } else {
      // no need to forward ccs to midi mix
    }
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

function sendOp1Text(output, text) {
  var list = [];
  list.push(text.length);
  for (var i = 0; i < text.length; i++) {
    list.push(text.charCodeAt(i));
  }
  return sendOp1Sequence(output, OP1_TEXT_START_SEQUENCE.concat(list));
}

function sendOp1Colors(output, colors) {
  var list = [];
  list.push(colors.length);
  for (var i = 0; i < colors.length; i++) {
    list = list.concat(colors[i]);
  }
  return sendOp1Sequence(output, OP1_TEXT_COLOR_START_SEQUENCE.concat(list));
}

function setupOp1() {
  let op1InputPortIdx = findMidiPort(input, "OP-1 Midi Device");
  let op1OutputPortIdx = findMidiPort(output, "OP-1 Midi Device");
  if (op1InputPortIdx === undefined || op1OutputPortIdx === undefined) {
    console.log("Could not find OP1");
    return false;
  }

  //setupMidiFilter(input, handleMixMidiNoteOn, handleMixMidiNoteOff, handleMixMidiCC);
  //setupMidiFilter(vInput, handleVirtualMidiNoteOn, handleVirtualMidiNoteOff, handleVirtualMidiCC);

  input.openPort(op1InputPortIdx);
  output.openPort(op1OutputPortIdx);

  sendOp1Sequence(output, OP1_ENABLE_SEQUENCE);
  //sendOp1Sequence(output, OP1_DISABLE_SEQUENCE);
  //output.sendMessage(MIDI_ID_SEQUENCE);
  sendOp1Text(output, "hello\rvirginia");


  sendOp1Colors(output, [[127,0,0],[0,127,0],[0,0,127]]);

  return true;
}


var i = 0;
var dir = 3;
function updateColors() {
  i = Math.max(i, 0);
  i = Math.min(i, 127);
  sendOp1Colors(output, [[i, 0, 0], [0, i, 0], [0, 0, i]]);
  sendOp1Text(output, "value\r"+i);
  i += dir;
  if (i >= 127 || i <= 0) { dir *= -1; }
  setTimeout(updateColors, 50);
}

app.on('ready', () => {
  if (!setupOp1()) {
    app.quit();
  }
  //setTimeout(updateColors, 50);

});

app.on('quit', () => {
  closeMidiPorts();
});
