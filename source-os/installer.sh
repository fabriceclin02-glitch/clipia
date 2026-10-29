#!/bin/bash
export DEBIAN_FRONTEND=noninteractive LC_ALL=C
R=/home/claude/os/rootfs
chroot $R apt-get install -y --no-install-recommends \
  linux-image-generic initramfs-tools casper network-manager wpasupplicant cage epiphany-browser \
  libpam-systemd polkitd fonts-dejavu-core fonts-noto-color-emoji libgl1-mesa-dri mesa-vulkan-drivers xkb-data kbd \
  pciutils usbutils parted gdisk dosfstools e2fsprogs rsync curl wget nano less openssh-client bash-completion \
  grub-pc-bin grub-efi-amd64-bin grub-common pipewire pipewire-pulse wireplumber alsa-utils \
  pigz zstd xz-utils iputils-ping dmidecode lshw smartmontools htop > install.log 2>&1
echo "FIN code=$?" >> install.log
