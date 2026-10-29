#!/bin/bash
# refaire.sh [rapide|final] : squashfs + ISO (BIOS+UEFI) à partir de rootfs/
cd /home/claude/os; mode=${1:-rapide}
mkdir -p rootfs/{proc,sys,dev,run,tmp,mnt,media,var/cache/debconf,var/crash,var/tmp}
rm -f iso/casper/filesystem.squashfs
if [ "$mode" = final ]; then C="-comp xz -Xbcj x86 -b 1M"; else C="-comp zstd -Xcompression-level 3 -b 256K"; fi
mksquashfs rootfs iso/casper/filesystem.squashfs $C -noappend -wildcards -e 'proc/*' 'sys/*' 'dev/*' 'run/*' 'tmp/*' -quiet >/dev/null 2>&1
cp -L rootfs/boot/vmlinuz iso/casper/vmlinuz; cp -L rootfs/boot/initrd.img iso/casper/initrd
out=${2:-test.iso}
xorriso -as mkisofs -r -V CLIPIA_OS -o $out -J -joliet-long -cache-inodes -iso-level 3 -partition_offset 16 \
 --grub2-mbr /usr/lib/grub/i386-pc/boot_hybrid.img --mbr-force-bootable -append_partition 2 0xef build/efi.img -appended_part_as_gpt \
 -iso_mbr_part_type a2a0d0ebe5b9334487c068b6b72699c7 -c /boot.catalog -b /boot/grub/i386-pc/eltorito.img -no-emul-boot -boot-load-size 4 -boot-info-table --grub2-boot-info \
 -eltorito-alt-boot -e '--interval:appended_partition_2:::' -no-emul-boot iso >/dev/null 2>&1
ls -la $out
