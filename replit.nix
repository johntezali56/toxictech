{ pkgs }: {
  deps = [
    pkgs.nodejs_22
    pkgs.ffmpeg
    pkgs.imagemagick
    pkgs.libwebp
    pkgs.git
  ];
}
