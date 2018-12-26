# ramp-thermostat

[![NPM version][npm-image]][npm-url]

[npm-image]: http://img.shields.io/npm/v/node-red-contrib-ramp-thermostat.svg
[npm-url]: https://npmjs.org/package/node-red-contrib-ramp-thermostat

A Node-RED contrib-node that emulates a programmable thermostat.

[Wikipedia Source](https://en.wikipedia.org/wiki/Programmable_thermostat): *A **programmable thermostat** is a thermostat which is designed to adjust the temperature according to a series of programmed settings that take effect at different times of the day. Programmable thermostats may also be called **clock thermostats**.*

The ramp-thermostat controls an actuator depending on the current input temperature and the target temperature (setpoint).
The target temperature is defined by a `profile` for a day period (00:00-23:59). A weekly or holiday setting can be achieved using several profiles.

## Configuration

The target temperature is defined by a profile that provides the value depending on the current time `00:00-23:59`. The profile consists of several points whose connections build a sequence of lines. The switching moment can be optimized by defining a gradient line like a `ramp`.

**A profile has at least 2 points and must start at 00:00 and end at 23:59.**

The hysteresis is used to prevent osciliation. The `[+]` value is added to the target and the `[-]` (absolute) value is subtracted from the target. Within this neutral zone no action accurs.

## Usage

This node expects a `numeric` msg.payload containing the current temperature (number). The msg.topic should be set to `setCurrent`. It will calculate the target temperature depending on msg.payload at the current time and output 3 values:

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

### setHysteresisPlus

```sh
msg.topic: setHysteresisPlus
msg.payload: nn.n (number)
```
The Hydteresis will be valid until a new hysteresis is set again or until node-red is restated.

### setHysteresisMinus

```sh
msg.topic: setHysteresisMinus
msg.payload: nn.n (number)
```
The Hydteresis will be valid until a new hysteresis is set again or until node-red is restated.

### getProfile

```sh
msg.topic: getProfile
msg.payload: profile-name
```

The profile object is sent to the output 3:

```sh
msg.topic: getProfile
msg.payload: {
  "name": "profile-name",
  "points": [{
    "00:00": 18
  }, {
    "04:00": 18
  }, {
    "08:00": 20.5
  }, {
    "12:00": 20.5
  }, {
    "12:00": 19
  }, {
    "12:30": 19
  }, {
    "13:30": 20.5
  }, {
    "19:00": 20.5
  }, {
    "19:00": 18
  }, {
    "23:59": 18
  }]
}
``` 

### setProfile

```sh
msg.topic: setProfile
msg.payload: profile-name
```

The profile-name is one of the existing profiles that are configured in the ramp-thermostat node.

You can even define an input profile (JSON object) with more than 10 points:

```sh
msg.topic: setProfile
msg.payload: {
    "name": "dining room",
    "points": [
        {"00:00": 18},
        {"03:00": 18},
        {"06:00": 18.5},
        {"08:00": 20},
        {"10:00": 20},
        {"11:00": 20.5},
        {"12:30": 20.5},
        {"12:30": 19.5},
        {"15:00": 19.5},
        {"17:00": 20.5},
        {"19:00": 20.5},
        {"19:00": 20},
        {"21:30": 20},
        {"21:30": 18},
        {"23:59": 18}
    ]
}
```

# Examples

![rt-office3](https://user-images.githubusercontent.com/5056710/48859523-8c681280-edbe-11e8-93f9-54dd0fb9524c.png)

The profile is defined using 6 points:

```sh
"time" : temp

"00:00": 18.0
"03:00": 18.0
"06:00": 20.0
"19:00": 20.0
"20:00": 18.0
"23:59": 18.0
```
