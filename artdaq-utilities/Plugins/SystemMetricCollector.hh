#include <sys/times.h>
#include <list>
#include <memory>
#include <string>
#include <unordered_map>
#include "artdaq-utilities/Plugins/MetricData.hh"

namespace artdaq {
/// <summary>
/// Collects metrics from the system, using proc filesystem or kernel API calls
/// </summary>
class SystemMetricCollector
{
public:
	/// <summary>
	/// SystemMetricCollector Constructor
	/// </summary>
	/// <param name="processMetrics">Whether to collect process-level metrics (i.e. process CPU/RAM)</param>
	/// <param name="systemMetrics">Whether to collect system-level metrics (i.e. System CPU/RAM/Network)</param>
	SystemMetricCollector(bool processMetrics, bool systemMetrics);

	/// <summary>
	/// Calculate the system CPU usage percentages
	/// </summary>
	void GetSystemCPUUsage();
	/// <summary>
	/// Return the current amount of CPU usage for the current process, %
	/// </summary>
	/// <returns>The current amount of CPU usage for the current process, %</returns>
	double GetProcessCPUUsagePercent();

	/// <summary>
	/// Get the amount of available RAM in the system
	/// </summary>
	/// <returns>The amount of available (free) RAM in bytes</returns>
	unsigned long GetAvailableRAM();
	/// <summary>
	/// Get the amount of RAM currently being used for cache
	/// </summary>
	/// <returns>The amount of RAM used in cache in bytes</returns>
	unsigned long GetBufferedRAM();
	/// <summary>
	/// Get the total amount of RAM in the system
	/// </summary>
	/// <returns>The total amount of RAM in the system, in bytes</returns>
	unsigned long GetTotalRAM();
	/// <summary>
	/// Get the percentage of available RAM
	/// </summary>
	/// <param name="buffers">Whether cache RAM should be counted as available</param>
	/// <returns>The amount of available RAM, in %</returns>
	double GetAvailableRAMPercent(bool buffers);
	/// <summary>
	/// Get the amount of RAM being used by this process
	/// </summary>
	/// <returns>The amount of RAM being used by this process, in bytes</returns>
	unsigned long GetProcessMemUsage();
	/// <summary>
	/// Get the amount of RAM being used by this process
	/// </summary>
	/// <returns>The amount of RAM used by this process, as a percentage of the total RAM in the system</returns>
	double GetProcessMemUsagePercent();

	/// <summary>
	/// Get the amount of data received from the network in the last network collection interval (1.0 s)
	/// </summary>
	/// <param name="ifname">Name of the interface to collect</param>
	/// <returns>The number of bytes recevied from the network in the last second</returns>
	unsigned long GetNetworkReceiveBytes(std::string ifname);
	/// <summary>
	/// Get the amount of data sent to the network in the last network collection interval (1.0 s)
	/// </summary>
	/// <param name="ifname">Name of the interface to collect</param>
	/// <returns>The number of bytes sent to the network in the last second</returns>
	unsigned long GetNetworkSendBytes(std::string ifname);
	/// <summary>
	/// Get the number of network receive errors in the last network collection interval (1.0 s)
	/// </summary>
	/// <param name="ifname">Name of the interface to collect</param>
	/// <returns>The number of network receive errors in the last second</returns>
	unsigned long GetNetworkReceiveErrors(std::string ifname);
	/// <summary>
	/// Get the number of network send errors in the last network collection interval (1.0 s)
	/// </summary>
	/// <param name="ifname">Name of the interface to collect</param>
	/// <returns>The number of network send errors in the last second</returns>
	unsigned long GetNetworkSendErrors(std::string ifname);

	std::list<std::string> GetNetworkInterfaceNames();
	/// <summary>
	/// Send the configured metrics
	/// </summary>
	/// <returns>A list of MetricData pointers for direct injection into MetricManager</returns>
	std::list<std::unique_ptr<MetricData>> SendMetrics();

private:
	struct cpustat
	{
		unsigned long long user, nice, system, idle, iowait, irq, softirq;
		unsigned long long totalUsage, total;
		cpustat()
		    : user(0), nice(0), system(0), idle(0), iowait(0), irq(0), softirq(0), totalUsage(0), total(0) {}
	};
	cpustat ReadProcStat_();
	static size_t GetCPUCount_(); // Read /proc/stat, count lines beyond the first that start with "cpu"
	size_t cpuCount_;
	double nonIdleCPUPercent_; // user + nice + system + iowait + irq + softirq
	double userCPUPercent_; // Includes nice
	double systemCPUPercent_;
	double idleCPUPercent_;
	double iowaitCPUPercent_;
	double irqCPUPercent_; // includes softirq

	struct netstat
	{
		unsigned long long send_bytes, recv_bytes, send_errs, recv_errs;
		netstat()
		    : send_bytes(0), recv_bytes(0), send_errs(0), recv_errs(0) {}
	};
	struct netstats {
		std::unordered_map<std::string, netstat> stats;
		std::chrono::steady_clock::time_point collectionTime;
	};
	netstats ReadProcNetDev_();
	void UpdateNetstat_();

	cpustat lastCPU_;
	struct tms lastProcessCPUTimes_;
	clock_t lastProcessCPUTime_;
	netstats thisNetStat_;
	netstats lastNetStat_;
	bool sendProcessMetrics_;
	bool sendSystemMetrics_;
};
}  // namespace artdaq