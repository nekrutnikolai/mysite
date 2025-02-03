---
title: "Portfolio"
date: 2024-09-29T23:14:17-04:00
draft: false
TOC: true
---

<!-- # Portfolio Test, consider using the table of contents, actually seems to be working now! -->

Hi, nice to meet you! My name is Nikolai Nekrutenko and here is my portfolio:

---

## Low-Cost Depth Sensor for Deep-Water Research 

**Sep 2024 - Present | Master's Thesis**

Developing a cost-effective pressure-sensing module to measure depths up to 2000 meters underwater, focusing on affordability, robustness, and ease of integration with Woods Hole Oceanographic Institution (WHOI) instruments. 

Advised by Dr. Hunter Adams from the Cornell Electrical and Computer Engineering Department and Jonathan Pfeifer from Woods Hole Oceanographic Institution.

Documentation and updates to come as the project progresses.

**Links:**
- [GitHub Repository](https://github.com/nekrutnikolai/depth_sensor)

---

## Infrared Sensor Integration for Next-Gen SLS products

**Jun 2024 - Aug 2024 | Formlabs**

{{< figure src="/img/portfolio/thermal_selfie.png" alt="A pic of me" position="center" style="border-radius: 8px;" title="IR selfie" titlePosition="center" >}}

Devised an experimental setup and methods to evaluate thermopile array infra-red (IR) sensors for next-gen
SLS printing technology to maximize performance and dimensional accuracy. 

Calculated the off-axis projection of sensor pixels and made an interactive tool in Observable JavaScript.

Developed test and alignment scripts in Python, automating the test setup to characterize IR
sensors. 

Built analysis Jupyter Notebooks in Python to compare the performance of sensors
across varying environmental conditions and sensor configurations using NumPy and SciPy.

**Links:**
- [Infrared Sensor Transform Utility & Documentation](https://observablehq.com/@nikolaiteslovich/infrared-sensor-transform-utility)

---

## Non-Orthogonal Gimbal Development 

**Jan 2024 - Apr 2024 | Freefly Systems**

Derived a physics-based model of the forward and inverse kinematics for an experimental non-orthogonal gimbal to be used in a future product. 

Assessed its experimental performance with modeled IMU data in Python. 

Throughout this experience I learned about how to analyze and verify
assumptions with experimental data, research and derive difficult concepts on my own, and
communicate with the team.

**Links:**
- [Kinematics Derivation](https://hackmd.io/@nekrutnikolai/Sku14A-sa)

---

## Cornell MAE Drone Development

**Jan 2024 - Apr 2024 | Cornell University Mechanical and Aerospace Engineering Department**

{{< figure src="https://github.com/cornellmotionstudio/DylanDronev2/raw/master/assets/DylanV2.jpg" alt="A pic of me" position="center" style="border-radius: 8px;" title="IR selfie" titlePosition="center" >}}

Developing a robust, low-cost quadcopter platform to be used in mechanical, aerospace, and electrical
engineering course labs as a supplementary hands-on lab component.

Guiding a team of underclassmen engineering students to develop this project, focusing on two main prototypes: 
1. A drone with a Pi Pico serving as the flight computer targeting electrical engineering and computer science coursework in microcontrollers programming for instance
2. A drone utilizing commercial off the shelf components targeting more mechanical engineering coursework in controls for instance

**Links:**
- [Wiki Page](https://github.com/cornellmotionstudio/DIYDrone/wiki)
    - [Drone 1](https://github.com/cornellmotionstudio/JacksonDronev2)
    - [Drone 2](https://github.com/cornellmotionstudio/DylanDronev2)
    - [Guide on 3D Printing](https://github.com/cornellmotionstudio/DIYDrone/wiki/How-to-3D-Print-on-the-Prusa-Mini)

---

## Mōvi Pro Gimbal Pan/Tilt Limits 

**Jun 2023 - Dec 2023 | Freefly Systems**

{{< youtube "7P_ka9fk7zw" >}}

Developed an embedded systems algorithm for smooth hard stops on Mōvi Pro gimbal pan and tilt axes based on IMU data, gimbal physics, and user input via Mōvi Wheels and Mōvi Controller as part of an upcoming experimental
firmware release. 

Created an interactive graphical interface with Javascript in Observable HQ for
the documentation to help users visualize how their user-defined settings would affect the motion
of the gimbal. 

This firmware release was requested by Larry McConkey and will be used by him
in upcoming productions such as new seasons of Marvelous Mrs. Maisel.

**Links:**
- [User Documentation](https://observablehq.com/d/2b2149d8f6355702)
- [Engineering Documentation](https://observablehq.com/@nikolaiteslovich/ptlimits)
- [Short Demonstrational Video](https://www.youtube.com/watch?v=7P_ka9fk7zw)

---

## QCoDeS-Interfacing 

**Jun 2022 - May 2023 | Fatemi Lab @ Cornell University**

{{< figure src="/img/portfolio/qcodes_interfacing.png" alt="A pic of me" position="center" style="border-radius: 8px;" title="Columbia Icefield, Jasper National Park" titlePosition="center">}}

A bundle of installation shell scripts, drivers,
well-documented documentation and Jupyter notebooks to setup a computer for programmatic
interfacing with older lab equipment over the GPIB interface with Python and QCoDeS, a
Python data acquisition framework.

**Links:**
- [GitHub Repository](https://github.com/nekrutnikolai/QCoDeS-Interfacing)
- [Presentation](https://docs.google.com/presentation/d/11rxnWTJ9ADGM96VsQl7Guu8UMdgqNuGSXEt3azbtyPw/edit?usp=sharing)

---

## NeoPixel FFT Audio Visualizer 

**Jun 2022 - Jan 2023 | Personal Project**

Co-designed and wrote a program that visualizes the waveform and intensity of music for a custom-built individually-addressable RGB led matrix using FFTs in Python on a Raspberry Pi and a few components beautifully hacked together on a breadboard using output from the Raspberry Pi’s GPIO pins.

**Links:**
- [GitHub Repository](https://github.com/nekrutnikolai/leds/tree/main)

---

## The Rocket Lab Initiative 

**Sep 2020 - Jun 2021 | Penn State University**

| {{< figure src="https://github.com/nekrutnikolai/RISE/blob/main/resources/payload1.jpg?raw=true" alt="A pic of me" position="center" style="border-radius: 8px;" title="IR selfie" titlePosition="center" >}} | {{< figure src="https://github.com/nekrutnikolai/RISE/blob/main/resources/payload2.jpg?raw=true" alt="A pic of me" position="center" style="border-radius: 8px; width: 99%" title="IR selfie" titlePosition="center" >}} |
| :---: | :---: |
|  *Camera, sensor & voltage regulator*  |  *Raspberry Pi Zero W*  |

Developed a 3D printed lightweight Raspberry Pi sensor and imaging payload as part of a PSU outreach with Dr. McEntaffer’s lab. Simulated the suborbital model rocket trajectory in OpenRocket and compared actual data against predicted.

**Links:**
- [GitHub Repository](https://github.com/nekrutnikolai/RISE)

---

## MinerWrangler 

**Nov 2020 - Apr 2021 | Personal Project**

{{< figure src="/img/portfolio/miner_wrangler.png" alt="A pic of me" position="center" style="border-radius: 8px;" title="Columbia Icefield, Jasper National Park" titlePosition="center">}}

Wrote a custom installation shell script for headless
Ubuntu-powered machines to allow for Ethereum mining. 

“MinerWrangler is the ultimate bundle
of bash scripts to ease your way into cryptocurrency mining that is open-source and gives you
full control over your rigs—by default. No monitor, keyboard, or mouse required.”

**Links:**
- [GitHub Repository](https://github.com/nekrutnikolai/minerwrangler)

---

## Arduino Consolometer 

**Oct 2019 - Feb 2020 | Personal Project**

{{< youtube "Srl9ST27SpA" >}}

Designed an Arduino-powered device that acts both as a thermometer and game console. 

Utilized a thermistor in a custom 3D printed waterproof enclosure to measure the temperature of water for a Science Olympiad Competition.

Gathered data with a voltage divider setup for the thermistor and analog readout pins on the
Arduino to analyze the data with Python and come up with the best line of fit and algorithm.
Resulted in first place in the regionals competition right before the start of COVID-19.

**Links:**
- [GitHub Repository](https://github.com/nekrutnikolai/Consolometer)
- [Stop-Motion Film](https://www.youtube.com/watch?v=Srl9ST27SpA)

---

## FPV Drones & Aircraft 

**Oct 2019 - Present | Personal Project**

{{< youtube "tDKgeVsfDjo" >}}

Building, flying (mostly crashing) FPV drones
and aircraft with custom-designed 3D printed components, and autonomous flight capabilities
using open-source flight software such as Betaflight and iNav. 

Occasionally use these drones for
cinematographic applications such as exploring the Colorado Plateau or chasing and filming a
car on a winding road to name a few.

**Links:**
- [Cinematic Drone Flight Playlist](https://youtube.com/playlist?list=PLWoHVszdLgExfQIUunZmBZD9PeuAHc0xA&si=1jTZ_nRUKnXjRYS)



