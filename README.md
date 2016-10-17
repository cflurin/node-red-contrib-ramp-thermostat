
### ramp-thermostat
A Node-RED contrib-node that emulates a thermostat.

The ramp-thermostat controls a heating-device such a valve depending on the actual input temperature and the target temperature.

The target temperature is defined by a profile that provides the value depending on the current time `00:00-24:00`. The profile consists of several points whose connections build a sequence of lines. The switching moment can be optimized by defining a gradient line like a `ramp`.

The node provides 3 outputs:

* state (boolean)
* actual temperature
* target temperature

### Installation

Change directory to your node red installation:

    $ npm install node-red-contrib-ramp-thermostat

### Configuration

Define a profile which consists of up to 10 points.
A profile has at least 2 points and should typically start at 00:00 and end at 24:00.
The target temperature is calculated depending on the actual time.

### Runtime settings

**setTarget**

```sh
msg.topic: setTarget
msg.payload: nn.n (number)
```

The target will be valid until a new target or a profile is set again or until node-red is restarted.

**setProfile**

```sh
msg.topic: setProfile
msg.payload: profile-name
```

The profile-name is one of the existing profiles that are configured in the ramp-thermostat node.

### Examples

![ramp-thermostat2](https://cloud.githubusercontent.com/assets/5056710/19309043/eb5b9bea-9082-11e6-995b-fb254b7d71e5.jpeg)

![ramp-thermostat1](https://cloud.githubusercontent.com/assets/5056710/19308860/0f76f35e-9082-11e6-8fa8-c1014cd3f142.jpg)

The profile is defined using 6 points:

time   | temp
-------|-------
00:00 | 18.0
03:00 | 18.0
06:00 | 20.5
18:00 | 20.5
20:00 | 18.0
24:00| 18.0
