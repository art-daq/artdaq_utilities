#include "trace.h"

#include <chrono>
#include "SystemMetricCollector.hh"
#include "sys/sysinfo.h"
#include "sys/types.h"
#include "unistd.h"

#define MLEVEL_PROCESS 6
#define MLEVEL_CPU 7
#define MLEVEL_RAM 8
#define MLEVEL_NETWORK 9

artdaq::SystemMetricCollector::SystemMetricCollector(bool processMetrics, bool systemMetrics)
    :  lastProcessCPUTimes_(), lastProcessCPUTime_(0), sendProcessMetrics_(processMetrics), sendSystemMetrics_(systemMetrics)
{
	lastCPU_ = ReadProcStat_();
	lastProcessCPUTime_ = times(&lastProcessCPUTimes_);
	thisNetStat_ = ReadProcNetDev_();
	lastNetStat_ = thisNetStat_;
}

double artdaq::SystemMetricCollector::GetSystemCPUUsagePercent()
{
	auto thisCPU = ReadProcStat_();
	auto totalUsage = thisCPU.totalUsage - lastCPU_.totalUsage;
	auto total = thisCPU.total - lastCPU_.total;
	lastCPU_ = thisCPU;
	return totalUsage * 100.0 / static_cast<double>(total);
}

double artdaq::SystemMetricCollector::GetProcessCPUUsagePercent()
{
	struct tms this_times;
	auto now = times(&this_times);

	if (now < 0)
	{
		return 0.0;
	}
	auto delta_t = now - lastProcessCPUTime_;
	auto utime = this_times.tms_utime - lastProcessCPUTimes_.tms_utime;
	auto stime = this_times.tms_stime - lastProcessCPUTimes_.tms_stime;

	lastProcessCPUTime_ = now;
	lastProcessCPUTimes_ = this_times;

	return utime + stime * 100.0 / static_cast<double>(delta_t);
}

unsigned long artdaq::SystemMetricCollector::GetAvailableRAM()
{
	struct sysinfo meminfo;
	auto err = sysinfo(&meminfo);
	if (err == 0)
	{
		return meminfo.freeram * meminfo.mem_unit;
	}
	return 0;
}

unsigned long artdaq::SystemMetricCollector::GetBufferedRAM()
{
	struct sysinfo meminfo;
	auto err = sysinfo(&meminfo);
	if (err == 0)
	{
		return meminfo.bufferram * meminfo.mem_unit;
	}
	return 0;
}

unsigned long artdaq::SystemMetricCollector::GetTotalRAM()
{
	struct sysinfo meminfo;
	auto err = sysinfo(&meminfo);
	if (err == 0)
	{
		return meminfo.totalram * meminfo.mem_unit;
	}
	return 0;
}

double artdaq::SystemMetricCollector::GetAvailableRAMPercent(bool buffers)
{
	struct sysinfo meminfo;
	auto err = sysinfo(&meminfo);
	if (err == 0)
	{
		auto available = meminfo.freeram + (buffers ? meminfo.bufferram : 0);
		return available * 100.0 / static_cast<double>(meminfo.totalram);
	}
	return 0.0;
}

unsigned long artdaq::SystemMetricCollector::GetProcessMemUsage()
{
	auto filp = fopen("/proc/self/statm", "r");
	unsigned long mem;
	fscanf(filp, "%*u %lu", &mem);
	fclose(filp);
	return mem * sysconf(_SC_PAGESIZE);
}

double artdaq::SystemMetricCollector::GetProcessMemUsagePercent()
{
	auto proc = GetProcessMemUsage();
	auto total = GetTotalRAM();
	return proc * 100.0 / static_cast<double>(total);
}

unsigned long artdaq::SystemMetricCollector::GetNetworkReceiveBytes()
{
	UpdateNetstat_();
	return thisNetStat_.recv_bytes - lastNetStat_.recv_bytes;
}

unsigned long artdaq::SystemMetricCollector::GetNetworkSendBytes()
{
	UpdateNetstat_();
	return thisNetStat_.send_bytes - lastNetStat_.send_bytes;
}

unsigned long artdaq::SystemMetricCollector::GetNetworkReceiveErrors()
{
	UpdateNetstat_();
	return thisNetStat_.recv_errs - lastNetStat_.recv_errs;
}

unsigned long artdaq::SystemMetricCollector::GetNetworkSendErrors()
{
	UpdateNetstat_();
	return thisNetStat_.send_errs - lastNetStat_.send_errs;
}

std::list<std::unique_ptr<artdaq::MetricData>> artdaq::SystemMetricCollector::SendMetrics()
{
	auto start_time = std::chrono::steady_clock::now();
	std::list<std::unique_ptr<MetricData>> output;
	if (sendProcessMetrics_)
	{
		output.emplace_back(new MetricData("Process CPU Usage", GetProcessCPUUsagePercent(), "%", MLEVEL_PROCESS, MetricMode::Average, "", false));
		output.emplace_back(new MetricData("Process RAM Usage", GetProcessMemUsage(), "B", MLEVEL_PROCESS, MetricMode::LastPoint, "", false));
	}
	if (sendSystemMetrics_)
	{
		output.emplace_back(new MetricData("System CPU Usage", GetSystemCPUUsagePercent(), "%", MLEVEL_CPU, MetricMode::Average, "", false));

		output.emplace_back(new MetricData("Free RAM", GetAvailableRAM(), "B", MLEVEL_RAM, MetricMode::LastPoint, "", false));
		output.emplace_back(new MetricData("Total RAM", GetTotalRAM(), "B", MLEVEL_RAM, MetricMode::LastPoint, "", false));
		output.emplace_back(new MetricData("Available RAM", GetAvailableRAMPercent(true), "%", MLEVEL_RAM, MetricMode::LastPoint, "", false));

		output.emplace_back(new MetricData("Network Receive Rate", GetNetworkReceiveBytes(), "B", MLEVEL_NETWORK, MetricMode::Rate, "", false));
		output.emplace_back(new MetricData("Network Send Rate", GetNetworkSendBytes(), "B", MLEVEL_NETWORK, MetricMode::Rate, "", false));
		output.emplace_back(new MetricData("Network Send Errors", GetNetworkSendErrors(), "Errors", MLEVEL_NETWORK, MetricMode::Accumulate, "", false));
		output.emplace_back(new MetricData("Network Receive Errors", GetNetworkReceiveErrors(), "Errors", MLEVEL_NETWORK, MetricMode::Accumulate, "", false));
	}

	TLOG(TLVL_DEBUG)
	    << "Time to collect system metrics: "
	    << std::chrono::duration_cast<std::chrono::microseconds>(std::chrono::steady_clock::now() - start_time).count()
	    << " us.";
	return output;
}

artdaq::SystemMetricCollector::cpustat artdaq::SystemMetricCollector::ReadProcStat_()
{
	auto filp = fopen("/proc/stat", "r");
	cpustat this_cpu;

	fscanf(filp, "cpu %llu %llu %llu %llu %llu %llu %llu", &this_cpu.user, &this_cpu.nice, &this_cpu.system,
	       &this_cpu.idle, &this_cpu.iowait, &this_cpu.irq, &this_cpu.softirq);
	fclose(filp);

	this_cpu.totalUsage =
	    this_cpu.user + this_cpu.nice + this_cpu.system + this_cpu.iowait + this_cpu.irq + this_cpu.softirq;
	this_cpu.total = this_cpu.totalUsage + this_cpu.idle;

	return this_cpu;
}

artdaq::SystemMetricCollector::netstat artdaq::SystemMetricCollector::ReadProcNetDev_()
{
	auto filp = fopen("/proc/net/dev", "r");
	char buf[200], ifname[20];
	netstat output;
	auto start_time = std::chrono::steady_clock::now();

	// skip first two lines
	for (int i = 0; i < 2; i++)
	{
		fgets(buf, 200, filp);
	}

	unsigned long rbytes, rerrs, rdrop, rfifo, rframe, tbytes, terrs, tdrop, tfifo, tcolls, tcarrier;

	while (fgets(buf, 200, filp) != nullptr)
	{
		sscanf(buf, "%[^:]: %lu %*u %lu %lu %lu %lu %*u %*u %lu %*u %lu %lu %lu %lu %lu", ifname, &rbytes, &rerrs,
		       &rdrop, &rfifo, &rframe, &tbytes, &terrs, &tdrop, &tfifo, &tcolls, &tcarrier);

		if (ifname[0] == 'e')
		{
			auto total_rerrs = rerrs + rdrop + rfifo + rframe;
			auto total_terrs = terrs + tdrop + tfifo + tcolls + tcarrier;
			output.recv_bytes += rbytes;
			output.send_bytes += tbytes;
			output.send_errs += total_terrs;
			output.recv_errs += total_rerrs;
		}
	}
	output.collectionTime = start_time;
	fclose(filp);

	return output;
}

void artdaq::SystemMetricCollector::UpdateNetstat_()
{
	auto start_time = std::chrono::steady_clock::now();
	// Only collect network stats once per second
	if (std::chrono::duration_cast<std::chrono::duration<double, std::ratio<1>>>(start_time - thisNetStat_.collectionTime)
	        .count() > 1.0)
	{
		auto output = ReadProcNetDev_();
		lastNetStat_ = thisNetStat_;
		thisNetStat_ = output;
	}
}
