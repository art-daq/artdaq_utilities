#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <confuse.h>   /* header for libconfuse */

#include <apr-1/apr.h>
#include <apr-1/apr_strings.h>
#include <apr-1/apr_pools.h>

#include "send_gmetric.h"
#include "ganglia.h"
//#include "cmdline.h"

Ganglia_pool global_context;
Ganglia_metric gmetric;
Ganglia_gmond_config gmond_config;
Ganglia_udp_send_channels send_channels;

/* The commandline options */
//struct gengetopt_args_info args_info;

int send_gmetric(const char* conf, const char* name, const char* value, const char* type, const char* units,
  const char* slope, int tmax, int dmax, const char* group, const char* cluster, 
  const char* desc, const char* title) 
{
  int rval;

  /* Create local char* versions of the parameters */
  char*    conf_local = (char *)conf;
  char*    name_local = (char *)name;
  char*   value_local = (char *)value;
  char*    type_local = (char *)type;
  char*   units_local = (char *)units;
  char*   slope_local = (char *)slope;
  char*   group_local = (char *)group;
  char* cluster_local = (char *)cluster;
  char*    desc_local = (char *)desc;
  char*   title_local = (char *)title;

  /* create the global context */
  global_context = Ganglia_pool_create(NULL);
  if(!global_context)
    {
      fprintf(stderr,"Unable to create global context. Exiting.\n");
      return 1;
    }
  
  /* parse the configuration file */
  int use_default_config = 1;
  if(strcmp(conf,"") != 0)
    {
      use_default_config = 0;
    }
  gmond_config = Ganglia_gmond_config_create( conf_local, use_default_config);

  /* build the udp send channels */
  send_channels = Ganglia_udp_send_channels_create(global_context, gmond_config);
  if(!send_channels)
    {
      fprintf(stderr,"Unable to create ganglia send channels. Exiting.\n");
      return 1;
    }

  /* create the message */
  gmetric = Ganglia_metric_create(global_context);
  if(!gmetric)
    {
      fprintf(stderr,"Unable to allocate gmetric structure. Exiting.\n");
      exit(1);
    }
  //apr_pool_t *gm_pool = (apr_pool_t*)gmetric->pool;

  if( ! (strcmp(name,"") != 0 && strcmp(value,"") != 0 && strcmp(type,"") != 0))
  {
    fprintf(stderr,"Incorrect options supplied, exiting.\n");
    return 1;
  }
  rval = Ganglia_metric_set( gmetric, name_local, value_local,
             type_local, units_local, cstr_to_slope(slope_local),
             tmax, dmax);

  /* TODO: make this less ugly later */
  switch(rval)
    {
    case 1:
      fprintf(stderr,"gmetric parameters invalid. exiting.\n");
      return 1; 
    case 2:
      fprintf(stderr,"one of your parameters has an invalid character '\"'. exiting.\n");
      return 1;
    case 3:
      fprintf(stderr,"the type parameter \"%s\" is not a valid type. exiting.\n", type);
      return 1;
    case 4:
      fprintf(stderr,"the value parameter \"%s\" does not represent a number. exiting.\n", value);
      return 1;
    }

  if(strcmp(cluster, "") != 0)
      Ganglia_metadata_add(gmetric, "CLUSTER", cluster_local);
  if(strcmp(group,"") != 0)
    {
      char *last;
      for (char *groupArg = apr_strtok(group_local, ", ", &last); groupArg != NULL; groupArg = apr_strtok(NULL, ", ", &last)) {
        Ganglia_metadata_add(gmetric, "GROUP", groupArg);
      }
    }
  if(strcmp(desc,"") != 0)
      Ganglia_metadata_add(gmetric, "DESC", desc_local);
  if(strcmp(title,"") != 0)
      Ganglia_metadata_add(gmetric, "TITLE", title_local);

  /* send the message */
  rval = Ganglia_metric_send(gmetric, send_channels);
  if(rval)
    {
      fprintf(stderr,"There was an error sending to %d of the send channels.\n", rval);
    }

  /* cleanup */
  Ganglia_metric_destroy(gmetric); /* not really necessary but for symmetry */
  Ganglia_pool_destroy(global_context);

  return 0;
}

int send_gmetric_usedefaults(const char* name, const char* value, const char* type, const char* group,
  const char* cluster, const char* desc, const char* title)
{
  return send_gmetric("", name, value, type, "", "both", 60, 0, group, cluster, desc, title);
}

int send_gmetric_useconfig(const char* conf,const char* name, const char* value, const char* type,
  const char* group, const char* cluster, const char* desc, const char* title)
{
  return send_gmetric(conf, name, value, type, "", "both", 60, 0, group, cluster, desc, title);
}
