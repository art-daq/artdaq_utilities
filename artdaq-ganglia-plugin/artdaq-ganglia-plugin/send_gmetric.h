#ifndef SEND_GMETRIC_H
#define SEND_GMETRIC H 1

#ifdef __cplusplus
extern "C" {
#endif

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int send_gmetric(const char* conf, const char* name, const char* value, const char* type, const char* units, 
  const char* slope, int tmax, int dmax, const char* group, const char* cluster, const char* desc, const char* title);

int send_gmetric_usedefaults(const char* name, const char* value, const char* type, const char* group,
  const char* cluster, const char* desc, const char* title);

int send_gmetric_useconfig(const char* conf, const char* name, const char* value, const char* type, const char* group, 
  const char* cluster, const char* desc, const char* title);

#ifdef __cplusplus
}
#endif

#endif
