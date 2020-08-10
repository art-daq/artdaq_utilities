#include <sys/times.h>
#include <list>
#include <memory>
#include <string>
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
	/// Return the current overall system CPU usage in %
	/// </summary>
	/// <returns>System CPU usage, %</returns>
	double GetSystemCPUUsagePercent();
	/// <summary>
	/// Return the current amount of CPU usage for the current process, %
	/// </summary>
	/// <returns>The current amount of CPU usage for the current process, %</returns>
	double GetProcessCPUUsagePercent();

	/// <summary>
	/// Get the amount of available RAM in the system
	/// </summary>
	/// <returns>The amount of available (free) RAM in bytes</returns>
	uint64_t GetAvailableRAM();
	/// <summary>
	/// Get the amount of RAM currently being used for cache
	/// </summary>
	/// <returns>The amount of RAM used in cache in bytes</returns>
	uint64_t GetBufferedRAM();
	/// <summary>
	/// Get the total amount of RAM in the system
	/// </summary>
	/// <returns>The total amount of RAM in the system, in bytes</returns>
	uint64_t GetTotalRAM();
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
	uint64_t GetProcessMemUsage();
	/// <summary>
	/// Get the amount of RAM being used by this process
	/// </summary>
	/// <returns>The amount of RAM used by this process, as a percentage of the total RAM in the system</returns>
	double GetProcessMemUsagePercent();

	/// <summary>
	/// Get the amount of data received from the network in the last network collection interval (1.0 s)
	/// </summary>
	/// <returns>The number of bytes recevied from the network in the last second</returns>
	uint64_t GetNetworkReceiveBytes();
	/// <summary>
	/// Get the amount of data sent to the network in the last network collection interval (1.0 s)
	/// </summary>
	/// <returns>The number of bytes sent to the network in the last second</returns>
	uint64_t GetNetworkSendBytes();
	/// <summary>
	/// Get the number of network receive errors in the last network collection interval (1.0 s)
	/// </summary>
	/// <returns>The number of network receive errors in the last second</returns>
	uint64_t GetNetworkReceiveErrors();
	/// <summary>
	/// Get the number of network send errors in the last network collection interval (1.0 s)
	/// </summary>
	/// <returns>The number of network send errors in the last second</returns>
	uint64_t GetNetworkSendErrors();

	/// <summary>
	/// Send the configured metrics
	/// </summary>
	/// <returns>A list of MetricData pointers for direct injection into MetricManager</returns>
	std::list<std::unique_ptr<MetricData>> SendMetrics();

private:
	struct cpustat
	{
		uint64_t user{0}, nice{0}, system{0}, idle{0}, iowait{0}, irq{0}, softirq{0};
		uint64_t totalUsage{0}, total{0};
	};
	cpustat ReadProcStat_();

	struct netstat
	{
		uint64_t send_bytes{0}, recv_bytes{0}, send_errs{0}, recv_errs{0};
		std::chrono::steady_clock::time_point collectionTime;
	};
	netstat ReadProcNetDev_();
	void UpdateNetstat_();

	cpustat lastCPU_;
	struct tms lastProcessCPUTimes_;
	clock_t lastProcessCPUTime_;
	netstat thisNetStat_;
	netstat lastNetStat_;
	bool sendProcessMetrics_;
	bool sendSystemMetrics_;
};
}  // namespace artdaq