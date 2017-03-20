# ramp-thermostat

[![NPM version][npm-image]][npm-url]

[npm-image]: http://img.shields.io/npm/v/node-red-contrib-ramp-thermostat.svg
[npm-url]: https://npmjs.org/package/node-red-contrib-ramp-thermostat

A Node-RED contrib-node that emulates a thermostat.

The ramp-thermostat controls an actuator depending on the current input temperature and the target temperature (setpoint).

### Installation

Run the following command in your Node-RED user directory - typically `~/.node-red`

    $ npm install node-red-contrib-ramp-thermostat

## Configuration

The target temperature is defined by a profile that provides the value depending on the current time `00:00-24:00`. The profile consists of several points whose connections build a sequence of lines. The switching moment can be optimized by defining a gradient line like a `ramp`.

A profile has at least 2 points and should typically start at 00:00 and end at 24:00.

The hysteresis is used to prevent osciliation. The `[+]` value is added to the target and the `[-]` (absolute) value is subtracted from the target. Within this neutral zone no action accurs.

## Usage

This node expects a numeric msg.payload containing the current temperature (number). The msg.topic should be `empty` or set to `setCurrent`. It will calculate the target temperature depending on msg.payload at the current time and output 3 values:

* state (boolean)
* current temperature (number)
* target temperature (number)

The state (true/false) is used to control an actuator. The current and target temperature outputs can be wired e.g. into an ui_chart node.

## Runtime settings

### setTarget

```sh
msg.topic: setTarget
msg.payload: nn.n (number)
```

The target will be valid until a new target or a profile is set again or until node-red is restarted.

### setProfile

```sh
msg.topic: setProfile
msg.payload: profile-name
```

The profile-name is one of the existing profiles that are configured in the ramp-thermostat node.

You can even define an input profile (JSON):

```sh
msg.topic: setProfile
msg.payload: {"name":"myGreatProfile","points":{"00:00":16.0,"08:00":20.0,"20:00":20.0,"24:00":16.0}}
```

# Examples

![ramp-thermostat2](https://cloud.githubusercontent.com/assets/5056710/19309043/eb5b9bea-9082-11e6-995b-fb254b7d71e5.jpeg)

![ramp-thermostat1](https://cloud.githubusercontent.com/assets/5056710/19308860/0f76f35e-9082-11e6-8fa8-c1014cd3f142.jpg)

The profile is defined using 6 points:

```sh
"time" : temp

"00:00": 18.0
"03:00": 18.0
"06:00": 20.5
"18:00": 20.5
"20:00": 18.0
"24:00": 18.0
```
