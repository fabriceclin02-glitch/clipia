#!/bin/bash
# synchro.sh : recopie l'application Clipia + l'overlay dans rootfs
R=/home/claude/os/rootfs; O=/home/claude/os/overlay
rm -rf $R/opt/clipia/app; mkdir -p $R/opt/clipia/app; (cd /home/claude/clipia && tar cf - --exclude=./node_modules --exclude=./data --exclude=./android --exclude=./installers --exclude=./desktop --exclude=./dist --exclude="*.zip" --exclude=.env .) | tar xf - -C $R/opt/clipia/app
chroot $R chown -R 1000:1000 /opt/clipia/app
cp -a $O/usr $O/etc $R/; chmod +x $R/usr/local/sbin/* $R/usr/local/bin/*
