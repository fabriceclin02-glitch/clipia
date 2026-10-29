#!/bin/bash
set -e
export LC_ALL=C DEBIAN_FRONTEND=noninteractive
R=/home/claude/os/rootfs; O=/home/claude/os/overlay; S=/tmp/claude-0/-home-claude/526acfcf-c4cf-5039-9317-e899695cebdb/scratchpad
# application + Node embarqué
rm -rf $R/opt/clipia; mkdir -p $R/opt/clipia/app $R/opt/clipia/runtime
(cd /home/claude/clipia && tar cf - --exclude=./node_modules --exclude=./data --exclude=./android --exclude=./installers --exclude=./desktop --exclude=./dist --exclude='*.zip' --exclude=.env .) | tar xf - -C $R/opt/clipia/app
cp $S/oc/node_modules/node-linux-x64/bin/node $R/opt/clipia/runtime/node; chmod 755 $R/opt/clipia/runtime/node
cp -a $O/usr $O/etc $R/
chmod +x $R/usr/local/sbin/* $R/usr/local/bin/*; chmod 440 $R/etc/sudoers.d/clipia
# identité, langue, clavier
echo clipia-os > $R/etc/hostname
printf '127.0.0.1 localhost\n127.0.1.1 clipia-os\n' > $R/etc/hosts
cat > $R/etc/os-release <<'OS'
PRETTY_NAME="Clipia OS 4.0 (base Ubuntu 24.04 LTS)"
NAME="Clipia OS"
VERSION_ID="4.0"
ID=clipia
ID_LIKE="ubuntu debian"
HOME_URL="https://fabriceclin02-glitch.github.io/clipia/"
OS
printf 'XKBMODEL="pc105"\nXKBLAYOUT="fr"\nXKBVARIANT=""\nXKBOPTIONS=""\nBACKSPACE="guess"\n' > $R/etc/default/keyboard
printf 'KEYMAP=fr\n' > $R/etc/vconsole.conf
echo "LANG=fr_FR.UTF-8" > $R/etc/default/locale
echo "Europe/Paris" > $R/etc/timezone; ln -sf /usr/share/zoneinfo/Europe/Paris $R/etc/localtime
chroot $R sh -c 'sed -i "s/^# *fr_FR.UTF-8/fr_FR.UTF-8/" /etc/locale.gen 2>/dev/null; grep -q fr_FR /etc/locale.gen || echo "fr_FR.UTF-8 UTF-8" >> /etc/locale.gen; locale-gen >/dev/null'
# utilisateur
chroot $R sh -c 'id clipia >/dev/null 2>&1 || useradd -m -u 1000 -s /bin/bash -G sudo,audio,video,input,render,netdev clipia; passwd -d clipia >/dev/null; passwd -l root >/dev/null'
cat > $R/home/clipia/.bash_profile <<'BP'
. /usr/local/bin/clipia-profile
BP
chroot $R chown -R clipia:clipia /home/clipia /opt/clipia/app 2>/dev/null || true
# casper
cat > $R/etc/casper.conf <<'CC'
export USERNAME="clipia"
export USERFULLNAME="Clipia"
export HOST="clipia-os"
export BUILD_SYSTEM="Ubuntu"
export FLAVOUR="Clipia OS"
CC
# thème de démarrage (Plymouth) + fond
chroot $R sh -c 'update-alternatives --install /usr/share/plymouth/themes/default.plymouth default.plymouth /usr/share/plymouth/themes/clipia/clipia.plymouth 200 && update-alternatives --set default.plymouth /usr/share/plymouth/themes/clipia/clipia.plymouth' >/dev/null 2>&1
chmod +x $R/usr/local/bin/*
# services
chroot $R systemctl enable clipia-persistance clipia NetworkManager >/dev/null 2>&1
chroot $R systemctl mask apt-daily.timer apt-daily-upgrade.timer motd-news.timer NetworkManager-wait-online.service >/dev/null 2>&1
chroot $R update-initramfs -u -k all >/dev/null 2>&1
# allègement
chroot $R apt-get clean; rm -rf $R/var/lib/apt/lists/* $R/usr/share/doc/* $R/usr/share/man/* $R/var/cache/* $R/usr/share/info/* 
find $R/usr/share/locale -mindepth 1 -maxdepth 1 ! -name 'fr*' ! -name 'locale.alias' -exec rm -rf {} + 2>/dev/null || true
rm -f $R/etc/resolv.conf; ln -sf ../run/systemd/resolve/stub-resolv.conf $R/etc/resolv.conf
echo OK; du -sh $R
