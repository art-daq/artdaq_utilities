
#include "fhiclcpp/ParameterSet.h"
#ifndef SIMPLER_PSET_MAKE
#include "fhiclcpp/make_ParameterSet.h"
#endif

namespace artdaq {
fhicl::ParameterSet make_pset(std::string const& config_str)
{
#ifdef SIMPLER_PSET_MAKE
	return fhicl::ParameterSet::make(config_str);
#else
	fhicl::ParameterSet tmp_pset;
	fhicl::make_ParameterSet(config_str, tmp_pset);
	return tmp_pset;
#endif
}
}  // namespace artdaq