# Nspire FS Fuse

**`(!)` Note: This project is in development. It is unstable and incomplete.**

______



## Install

### Clone repo and install `npm` dependencies:

```bash
git clone https://github.com/antonilol/nspirefs-fuse.git
cd nspirefs-fuse
npm i
```

### Install [ErnyTech/nspire-tools](https://github.com/ErnyTech/nspire-tools):

#### Arch Linux:
With an AUR helper ([yay](https://aur.archlinux.org/packages/yay) for example)

```bash
yay -S nspire-tools-git
```

or the standard way

```bash
git clone https://aur.archlinux.org/nspire-tools-git.git
cd nspire-tools-git
makepkg -si
```

#### Other distros (or Mac):

Dependencies (link points to arch repos):
- [libnspire-git](https://aur.archlinux.org/packages/libnspire-git/) (AUR)
- [liblphobos](https://archlinux.org/packages/community/x86_64/liblphobos/)
- [dub](https://archlinux.org/packages/community/x86_64/dub/) (compile only)
- [ldc](https://archlinux.org/packages/community/x86_64/ldc/) (compile only)

Find your distro's equivalent to the dependencies and install them.

Build and install `nspire-tools`:
```bash
git clone https://github.com/ErnyTech/nspire-tools.git
cd nspire-tools
dub build --force --compiler=ldc -b release
sudo install -m755 nspire-tools /usr/bin/nspire-tools
# optional for complete install, not required by nspirefs-fuse
cd /usr/bin
sudo ln -sr nspire-tools nspire-filemanager
sudo ln -sr nspire-tools nspire-updater
sudo ln -sr nspire-tools nspire-info
```

______

### TODO list alpha dev

implemented (`nspire-tools filemanager` command, fuse implementation):
- [x] ls (readdir)
- [x] info (getattr)
- [ ] ~~cp (write)~~
- [ ] mv (rename)
- [ ] rm (unlink)
- [ ] mkdir (mkdir)
- [ ] rmdir (rmdir)
- [ ] push (write, create)
- [ ] pull (read)

