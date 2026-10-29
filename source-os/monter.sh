#!/bin/bash
R=/home/claude/os/rootfs
mount --bind /dev $R/dev; mount -t devpts devpts $R/dev/pts; mount -t proc proc $R/proc; mount -t sysfs sys $R/sys; cp /etc/resolv.conf $R/etc/resolv.conf
