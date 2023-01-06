#ifndef artdaq_utilities_BuildInfo_GetPackageBuildInfo_hh
#define artdaq_utilities_BuildInfo_GetPackageBuildInfo_hh

#include "artdaq-utilities/BuildInfo/PackageBuildInfo.hh"

#include <string>

/**
 * \brief Namespace used to differentiate the artdaq_utilities version of GetPackageBuildInfo
 * from other versions present in the system.
 */
namespace artdaqutilities {
/**
 * \brief Wrapper around the artdaqutilities::GetPackageBuildInfo::getPackageBuildInfo function
 */
struct GetPackageBuildInfo
{
	/**
	 * \brief Gets the version number and build timestmap for artdaq_utilities
	 * \return An artdaq::PackageBuildInfo object containing the version number and build timestamp for artdaq_utilities
	 */
	static artdaq::PackageBuildInfo getPackageBuildInfo();
};
}  // namespace artdaqutilities

#endif /* artdaq_utilities_BuildInfo_GetPackageBuildInfo_hh */
