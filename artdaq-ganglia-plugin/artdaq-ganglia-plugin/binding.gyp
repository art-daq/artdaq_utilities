{
  "targets": [
  {
    "target_name": "gmetric",
    "sources": ["send_gmetric.c", "gmetric_wrap.cxx"],
    "libraries": [
      "/usr/lib64/libganglia.so",
    ],
    "cflags": [
      "-std=gnu99"
    ]
  }
 ]
}
