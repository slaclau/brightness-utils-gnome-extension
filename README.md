# gnome-extension-brightness-utils

Simple GNOME extension to control displays' brightness via DDC.
Additionally allows for control of night light temperature + enable/disable + pause/resume

## Preparation

1. Install `ddcutil`:

```shell
sudo apt install ddcutil
```

2. Set I2C permissions for non-root users:

```shell
sudo adduser $USER i2c
sudo /bin/sh -c 'echo i2c-dev >> /etc/modules'
```

A reboot is needed.

## Official GNOME Shell Extensions website

TBC
