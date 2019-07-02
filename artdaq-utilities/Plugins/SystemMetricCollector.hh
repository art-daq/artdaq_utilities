#include <sys/times.h>
#include <list>
#include <memory>
#include <string>
#include "artdaq-utilities/Plugins/MetricData.hh"

namespace artdaq {
class SystemMetricCollector
{
public:
	SystemMetricCollector(bool processMetrics, bool systemMetrics);

	double GetSystemCPUUsagePercent();
	double GetProcessCPUUsagePercent();

	unsigned long GetAvailableRAM();
	unsigned long GetBufferedRAM();
	unsigned long GetTotalRAM();
	double GetAvailableRAMPercent(bool buffers);
	unsigned long GetProcessMemUsage();
	double GetProcessMemUsagePercent();

	unsigned long GetNetworkReceiveBytes();
	unsigned long GetNetworkSendBytes();
	unsigned long GetNetworkReceiveErrors();
	unsigned long GetNetworkSendErrors();

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

	struct netstat
	{
		unsigned long long send_bytes, recv_bytes, send_errs, recv_errs;
		std::chrono::steady_clock::time_point collectionTime;
		netstat()
		    : send_bytes(0), recv_bytes(0), send_errs(0), recv_errs(0) {}
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