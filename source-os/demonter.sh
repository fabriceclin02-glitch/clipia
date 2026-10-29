#!/bin/bash
R=/home/claude/os/rootfs
for m in dev/pts dev proc sys; do umount -l $R/$m 2>/dev/null; done
