#include "TRACE/trace.h"
#define TRACE_NAME "SystemMetricCollector"

#include <chrono>
#include <fstream>
#include "SystemMetricCollector.hh"
#include "sys/sysinfo.h"
#include "sys/types.h"
#include "unistd.h"

#define MLEVEL_PROCESS 6
#define MLEVEL_CPU 7
#define MLEVEL_RAM 8
#define MLEVEL_NETWORK 9

artdaq::SystemMetricCollector::SystemMetricCollector(bool processMetrics, bool systemMetrics)
    : cpuCount_(GetCPUCount_())
    , nonIdleCPUPercent_(0)
    , userCPUPercent_(0)
    , systemCPUPercent_(0)
    , idleCPUPercent_(0)
    , iowaitCPUPercent_(0)
    , irqCPUPercent_(0)
    , lastCPU_()
    , lastProcessCPUTimes_()
    , lastProcessCPUTime_(0)
    , sendProcessMetrics_(processMetrics)
    , sendSystemMetrics_(systemMetrics)
{
	lastCPU_ = ReadProcStat_();
	lastProcessCPUTime_ = times(&lastProcessCPUTimes_);
	thisNetStat_ = ReadProcNetDev_();
	lastNetStat_ = thisNetStat_;
}

void artdaq::SystemMetricCollector::GetSystemCPUUsage()
{
	auto thisCPU = ReadProcStat_();
	auto total = static_cast<double>(thisCPU.total - lastCPU_.total);

	if (total == 0)
	{
		nonIdleCPUPercent_ = 0;
		userCPUPercent_ = 0;
		systemCPUPercent_ = 0;
		idleCPUPercent_ = 0;
		iowaitCPUPercent_ = 0;
		irqCPUPercent_ = 0;
		return;
	}

	nonIdleCPUPercent_ = (thisCPU.totalUsage - lastCPU_.totalUsage) * 100.0 * cpuCount_ / total;
	userCPUPercent_ = (thisCPU.user + thisCPU.nice - lastCPU_.user - lastCPU_.nice) * 100.0 * cpuCount_ / total;
	systemCPUPercent_ = (thisCPU.system - lastCPU_.system) * 100.0 * cpuCount_ / total;
	idleCPUPercent_ = (thisCPU.idle - lastCPU_.idle) * 100.0 * cpuCount_ / total;
	iowaitCPUPercent_ = (thisCPU.iowait - lastCPU_.iowait) * 100.0 * cpuCount_ / total;
	irqCPUPercent_ = (thisCPU.irq + thisCPU.softirq - lastCPU_.irq - lastCPU_.softirq) * 100.0 * cpuCount_ / total;

	lastCPU_ = thisCPU;
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
	if (delta_t == 0) return 0;

	auto utime = this_times.tms_utime - lastProcessCPUTimes_.tms_utime;
	auto stime = this_times.tms_stime - lastProcessCPUTimes_.tms_stime;

	lastProcessCPUTime_ = now;
	lastProcessCPUTimes_ = this_times;

	return (utime + stime) * 100.0 / static_cast<double>(delta_t);
}

uint64_t artdaq::SystemMetricCollector::GetAvailableRAM()
{
	struct sysinfo meminfo;
	auto err = sysinfo(&meminfo);
	if (err == 0)
	{
		return meminfo.freeram * meminfo.mem_unit;
	}
	return 0;
}

uint64_t artdaq::SystemMetricCollector::GetBufferedRAM()
{
	struct sysinfo meminfo;
	auto err = sysinfo(&meminfo);
	if (err == 0)
	{
		return meminfo.bufferram * meminfo.mem_unit;
	}
	return 0;
}

uint64_t artdaq::SystemMetricCollector::GetTotalRAM()
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
	if (err == 0 && meminfo.totalram > 0)
	{
		auto available = meminfo.freeram + (buffers ? meminfo.bufferram : 0);
		return available * 100.0 / static_cast<double>(meminfo.totalram);
	}
	return 0.0;
}

uint64_t artdaq::SystemMetricCollector::GetProcessMemUsage()
{
	auto filp = fopen("/proc/self/statm", "r");
	uint64_t mem;
	fscanf(filp, "%*u %lu", &mem);  // NOLINT(cert-err34-c) Proc files are defined by the kernel API, and will not have unexpected values
	fclose(filp);
	return mem * sysconf(_SC_PAGESIZE);
}

double artdaq::SystemMetricCollector::GetProcessMemUsagePercent()
{
	auto proc = GetProcessMemUsage();
	auto total = GetTotalRAM();
	if (total == 0) return 0;
	return proc * 100.0 / static_cast<double>(total);
}

uint64_t artdaq::SystemMetricCollector::GetNetworkReceiveBytes(std::string ifname)
{
	UpdateNetstat_();
	return thisNetStat_.stats[ifname].recv_bytes - lastNetStat_.stats[ifname].recv_bytes;
}

uint64_t artdaq::SystemMetricCollector::GetNetworkSendBytes(std::string ifname)
{
	UpdateNetstat_();
	return thisNetStat_.stats[ifname].send_bytes - lastNetStat_.stats[ifname].send_bytes;
}

uint64_t artdaq::SystemMetricCollector::GetNetworkReceiveErrors(std::string ifname)
{
	UpdateNetstat_();
	return thisNetStat_.stats[ifname].recv_errs - lastNetStat_.stats[ifname].recv_errs;
}

uint64_t artdaq::SystemMetricCollector::GetNetworkTCPRetransSegs()
{
	auto filp = fopen("/proc/net/snmp", "r");
#define BFSZ_ 200
	char tcp_lbls[BFSZ_];
	char tcp_data[BFSZ_];
	char* bufptr = tcp_lbls;

	// find the Tcp line token
#define TCP_LINE_TKN_ "Tcp:"
#define TCP_RETRANSSEGS_TKN_ "RetransSegs"
	uint64_t retranssegs = 0;
	while (fgets(bufptr, BFSZ_ - 1, filp) != nullptr)
		if (strstr(bufptr, TCP_LINE_TKN_))
		{
			char *tokn_name, *tokn_data, *tokn_save, *data_save;
			fgets(tcp_data, BFSZ_ - 1, filp);
			tokn_name = strtok_r(tcp_lbls, " ", &tokn_save);
			tokn_data = strtok_r(tcp_data, " ", &data_save);
			while (tokn_name != NULL && strcmp(tokn_name, TCP_RETRANSSEGS_TKN_) != 0)
			{
				tokn_name = strtok_r(NULL, " ", &tokn_save);
				tokn_data = strtok_r(NULL, " ", &data_save);
			}
			if (tokn_name) retranssegs = strtoull(tokn_data, 0, 0);
			break;
		}
	TRACE(TLVL_DEBUG + 10, "retranssegs=%lu", retranssegs);
	fclose(filp);
	return 0;
}

uint64_t artdaq::SystemMetricCollector::GetNetworkSendErrors(std::string ifname)
{
	UpdateNetstat_();
	return thisNetStat_.stats[ifname].send_errs - lastNetStat_.stats[ifname].send_errs;
}

std::list<std::string> artdaq::SystemMetricCollector::GetNetworkInterfaceNames()
{
	std::list<std::string> output;
	for (auto& i : thisNetStat_.stats)
	{
		output.push_back(i.first);
	}
	return output;
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
		GetSystemCPUUsage();
		output.emplace_back(new MetricData("System CPU Usage", nonIdleCPUPercent_, "%", MLEVEL_CPU, MetricMode::Average, "", false));
		output.emplace_back(new MetricData("System CPU User", userCPUPercent_, "%", MLEVEL_CPU, MetricMode::Average, "", false));
		output.emplace_back(new MetricData("System CPU System", systemCPUPercent_, "%", MLEVEL_CPU, MetricMode::Average, "", false));
		output.emplace_back(new MetricData("System CPU Idle", idleCPUPercent_, "%", MLEVEL_CPU, MetricMode::Average, "", false));
		output.emplace_back(new MetricData("System CPU IOWait", iowaitCPUPercent_, "%", MLEVEL_CPU, MetricMode::Average, "", false));
		output.emplace_back(new MetricData("System CPU IRQ", irqCPUPercent_, "%", MLEVEL_CPU, MetricMode::Average, "", false));

		output.emplace_back(new MetricData("Free RAM", GetAvailableRAM(), "B", MLEVEL_RAM, MetricMode::LastPoint, "", false));
		output.emplace_back(new MetricData("Total RAM", GetTotalRAM(), "B", MLEVEL_RAM, MetricMode::LastPoint, "", false));
		output.emplace_back(new MetricData("Available RAM", GetAvailableRAMPercent(true), "%", MLEVEL_RAM, MetricMode::LastPoint, "", false));

		for (auto& ifname : GetNetworkInterfaceNames())
		{
			output.emplace_back(new MetricData(ifname + " Network Receive Rate", GetNetworkReceiveBytes(ifname), "B", MLEVEL_NETWORK, MetricMode::Rate, "", false));
			output.emplace_back(new MetricData(ifname + " Network Send Rate", GetNetworkSendBytes(ifname), "B", MLEVEL_NETWORK, MetricMode::Rate, "", false));
			output.emplace_back(new MetricData(ifname + " Network Send Errors", GetNetworkSendErrors(ifname), "Errors", MLEVEL_NETWORK, MetricMode::Accumulate, "", false));
			output.emplace_back(new MetricData(ifname + " Network Receive Errors", GetNetworkReceiveErrors(ifname), "Errors", MLEVEL_NETWORK, MetricMode::Accumulate, "", false));
		}
		output.emplace_back(new MetricData("Network TCP RetransSegs", GetNetworkTCPRetransSegs(), "Segs", MLEVEL_NETWORK, MetricMode::Rate, "", false));
	}

	TLOG(TLVL_DEBUG + 35)
	    << "Time to collect system metrics: "
	    << std::chrono::duration_cast<std::chrono::microseconds>(std::chrono::steady_clock::now() - start_time).count()
	    << " us.";
	return output;
}

artdaq::SystemMetricCollector::cpustat artdaq::SystemMetricCollector::ReadProcStat_()
{
	auto filp = fopen("/proc/stat", "r");
	cpustat this_cpu;

	fscanf(filp, "cpu %lu %lu %lu %lu %lu %lu %lu", &this_cpu.user, &this_cpu.nice, &this_cpu.system,  // NOLINT(cert-err34-c) Proc files are defined by the kernel API, and will not have unexpected values
	       &this_cpu.idle, &this_cpu.iowait, &this_cpu.irq, &this_cpu.softirq);
	fclose(filp);

	// Reset iowait if it decreases
	if (this_cpu.iowait < lastCPU_.iowait)
	{
		auto diff = lastCPU_.iowait - this_cpu.iowait;
		lastCPU_.iowait = this_cpu.iowait;
		lastCPU_.total -= diff;
		lastCPU_.totalUsage -= diff;
	}

	this_cpu.totalUsage =
	    this_cpu.user + this_cpu.nice + this_cpu.system + this_cpu.iowait + this_cpu.irq + this_cpu.softirq;
	this_cpu.total = this_cpu.totalUsage + this_cpu.idle;

	return this_cpu;
}

size_t artdaq::SystemMetricCollector::GetCPUCount_()
{
	size_t count = 0;
	std::ifstream file("/proc/stat");
	std::string line;
	bool first = true;
	while (std::getline(file, line))
	{
		if (first)
		{
			first = false;
			continue;
		}
		if (line.find("cpu") == 0)
		{
			count++;
		}
		else
		{
			break;
		}
	}
	return count;
}

artdaq::SystemMetricCollector::netstats artdaq::SystemMetricCollector::ReadProcNetDev_()
{
	auto filp = fopen("/proc/net/dev", "r");
	char buf[200], ifname_c[20];
	auto start_time = std::chrono::steady_clock::now();
	netstats output;

	// skip first two lines
	for (int i = 0; i < 2; i++)
	{
		fgets(buf, 200, filp);
	}

	uint64_t rbytes, rerrs, rdrop, rfifo, rframe, tbytes, terrs, tdrop, tfifo, tcolls, tcarrier;

	while (fgets(buf, 200, filp) != nullptr)
	{
		sscanf(buf, " %[^:]: %lu %*u %lu %lu %lu %lu %*u %*u %lu %*u %lu %lu %lu %lu %lu", ifname_c, &rbytes, &rerrs,  // NOLINT(cert-err34-c) Proc files are defined by the kernel API, and will not have unexpected values
		       &rdrop, &rfifo, &rframe, &tbytes, &terrs, &tdrop, &tfifo, &tcolls, &tcarrier);

		std::string ifname(ifname_c);
		netstat stat;

		auto total_rerrs = rerrs + rdrop + rfifo + rframe;
		auto total_terrs = terrs + tdrop + tfifo + tcolls + tcarrier;
		stat.recv_bytes = rbytes;
		stat.send_bytes = tbytes;
		stat.send_errs = total_terrs;
		stat.recv_errs = total_rerrs;

		output.stats[ifname] = stat;
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
