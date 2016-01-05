# MidiMIX-filter: support scripts for MIDImix usage

This program adds multiple banks and other funky features for MIDImix.
This is pretty much for my own use, so that I can use the MIDIMix outside
of ableton and control multiple synths.

## Installation

Run `npm install`, followed by `node_modules/.bin/electron-rebuild` to link the
native MIDI library.
This does not really have a GUI yet, but it might be planned for the future,
hence the electron wrapper.

## Usage and functionality

Run the program using `npm start`.
It will search for a MIDI device called "MIDI Mix",
and another one called "Reaktor 6 Virtual Input/Output".

The MIDIMix "Bank Left" and "Bank Right" can now be used to switch
amongst MIDI channels.
The currently selected channel is highlighted on the MUTE row.

The buttons rows are transformed to CC messages.
MUTE is mapped to CCs 0-7.
REC is mapped to CCs 8-15.
SOLO is mapped to CCs 32-39.

When the SOLO button, all CCs from knobs are shifted by 64,
allowing for 32 more knobs to me mapped per channel.
