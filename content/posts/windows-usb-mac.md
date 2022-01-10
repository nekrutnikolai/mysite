---
title: "Making Windows Install Media on a Mac"
date: 2022-01-10T16:50:50+01:00
draft: true
toc: false
images:
tags:
  - Windows
  - MacOS
  - CLI
---

Creating a bootable, functional windows installation media is done wrongly in so many of the guides I checked, that it can truly send someone down a rabbit hole of confusion figuring what messed up. It took me several attempts and countless hours to finally figure out a way that works.

**So, let us begin:**

First of all, the latest Windows 10 Recovery Image needs to be downloaded from [Microsoft's website](https://www.microsoft.com/en-us/software-download/windows10ISO).

Select the version, language and either the 64 or 32 bit version depending on your system (most likely the 64 bit version).

Once that is downloaded, click on the downloaded file to mount it. In a sense, we are attaching it like a thumb-drive to copy data from it to our actual usb stick or other kind of storage drive. Anything that can be plugged into the computer that windows is going to be installed on is fair game.

Next, we will use the MacOS terminal to find and format the external drive that will be our installation media.

Windows is dumb. For some reason, they decided to make the `install.wim` file larger than 4GB, the file size limit for the FAT format which our drive is now formatted in. So, we have to split this file up into two pieces, which requires special software called wimlib.

If you don't already have homebrew installed:

Install wimlib:

Then, run the following command:

There's no harm in running it if you're not sure, it'll let you know if you already having it before going ahead with the install.

Go grab a coffee or tea, or go on a walk while the files are copied over to the external storage media, particularly if using an old USB drive.

Now go and enjoy your windows machine for whatever your mac apparently isn't already good enough.

This guide was greatly inspired by [this youtube video](https://www.youtube.com/watch?v=ZVW7FyIEoDQ&list=PLWoHVszdLgEzdxylAmHhAVaxHe-1BfzpT&index=9&t=337s)
