#!/bin/bash
# nettoyage avant empaquetage
cd /home/claude/os; R=rootfs
chroot $R apt-get clean; rm -rf $R/var/lib/apt/lists/* $R/usr/share/doc/* $R/usr/share/man/* $R/var/cache/* $R/usr/share/info/*
rm -f $R/etc/resolv.conf; ln -sf ../run/systemd/resolve/stub-resolv.conf $R/etc/resolv.conf
rm -f $R/root/.bash_history $R/var/log/*.log; rm -rf $R/tmp/* $R/var/tmp/*
chroot $R update-initramfs -u -k all >/dev/null 2>&1
rm -f $R/boot/*.old $R/boot/System.map* $R/boot/config-*
