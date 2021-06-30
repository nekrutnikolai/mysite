---
title: "Black Belt Essay - How to Build a Website for Your Studio"
date: 2021-06-27T10:38:15-04:00
draft: true
toc: true
images:
tags:
  - website
  - WTSDA
  - tutorial
---

**Written by Nikolai Nekrutenko**

**Cho Dan Bo #168632**

**A Mountain Wind Martial Arts**

**Studio Head: Master Susan Strohm, Sah Dan**

# Abstract

  > “A book really is judged by its cover—for better or worse”

Explained in terms for someone who has never interacted with the command line
Mac OS and Linux supported

Most will agree that a book is judged by its cover—for better or worse. Websites are the covers of your studio, organization, or even yourself, which are the books. Well-built websites equate to credibility and legitimacy. They are the bridge between your inner circle and the outer world by connecting members to the outside world. A good-looking, well functioning website is essential to making your mark in the world. On the other hand, a poorly built website can be worse that if it hadn’t existed.

The key to a good, first website is simplicity and understanding how all of the moving components of the machine mesh together. Following this tutorial, you will build a great, simple website for anything you want to. I wrote it as if I were building a website for my studio, which I did do.

If you’ve never used the command line, there’s nothing to be scared about. I guarantee you it will soon become your preferred way of doing things. Following this guide, you are going to build a website using the [Hello Friend NG theme by Djordje Atlialp](https://github.com/rhazdon/hugo-theme-hello-friend-ng). I wrote this guide specifically for Macintosh and Linux users, but with a bit of searching, these same steps can be applied to Windows machines.


# Let's get started!

***Add commenting to this post so I can answer questions***

### Opening terminal

Open the Macintosh application **Terminal**. It should look like this:

{{< figure src="/img/BBEssay/terminal.png" alt="Hello Friend" position="center" style="border-radius: 8px;" title="parts" titlePosition="center">}}

### Installing Xcode Command Line Tools

Into the terminal window, paste in the following:

```
xcode-select --install
```

And hit enter.

### Installing Homebrew

[Homebrew](https://brew.sh/) is a Mac package manager. In other words, it automates the process of managing software, making it easier to install software.

```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### Installing HUGO

[HUGO](https://gohugo.io/) is an open-source static site generator. Meaning that it generates websites provided on the parameters that you provide. [need to improve this section]

```
brew install hugo
```

### Navigating the file system of your computer

Let's create a directory (folder) to put our website in.

```
mkdir myamazingwebsite
```

*Hint: you can use Tab to autocomplete a terminal entry*

Now, to enter the directory, use `cd`:

```
cd myamazingwebsite
```

*Just for fun: this can be done in a single command*:

```
mkdir myamazingwebsite && cd myamazingwebsite
```

### Importing the website theme
