#ifndef ARTDAQ_MAKE_PARAMETER_SET_HH
#define ARTDAQ_MAKE_PARAMETER_SET_HH

#include "fhiclcpp/ParameterSet.h"
#ifndef SIMPLER_PSET_MAKE
#include "fhiclcpp/make_ParameterSet.h"
#endif

namespace artdaq {
inline fhicl::ParameterSet make_pset(std::string const& config_str)
{
#ifdef SIMPLER_PSET_MAKE
	return fhicl::ParameterSet::make(config_str);
#else
	fhicl::ParameterSet tmp_pset;
	fhicl::make_ParameterSet(config_str, tmp_pset);
	return tmp_pset;
#endif
}

inline fhicl::ParameterSet make_pset(std::string const& config_file, cet::filepath_maker& maker)
{
#ifdef SIMPLER_PSET_MAKE
	return fhicl::ParameterSet::make(config_file, maker);
#else
	fhicl::ParameterSet tmp_pset;
	fhicl::make_ParameterSet(config_file, maker, tmp_pset);
	return tmp_pset;
#endif
}
}  // namespace artdaq

#endif  // ARTDAQ_MAKE_PARAMETER_SET_HH