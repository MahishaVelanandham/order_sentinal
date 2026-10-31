import React, { useState, useEffect } from 'react';
import {
  Workflow,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Cpu,
  ArrowRight,
  Shield,
  Layers,
  ChevronRight,
  ExternalLink,
  Activity,
  Server,
  User,
  Wifi,
  DollarSign
} from 'lucide-react';
import { fetchOrderTimeline, detectOrderFailure } from '../services/api';

export default function OrderDetails({
  selectedOrder,
  orders = [],
  onSelectOrder,
  onNavigateTab
}) {
  const [currentOrder, setCurrentOrder] = useState(selectedOrder || orders[0] || null);
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState(null);

  // Sync when prop changes
  useEffect(() => {
    if (selectedOrder) {
      setCurrentOrder(selectedOrder);
    } else if (!currentOrder && orders.length > 0) {
      setCurrentOrder(orders[0]);
    }
  }, [selectedOrder, orders]);

  // Load timeline events whenever currentOrder changes
  useEffect(() => {
    if (!currentOrder) return;
    let isMounted = true;
    setIsLoadingTimeline(true);
    setDetectionResult(null);

    fetchOrderTimeline(currentOrder.orderNumber || currentOrder._id)
      .then((res) => {
        if (isMounted) {
          setTimelineEvents(res.timeline || res.events || []);
          setIsLoadingTimeline(false);
        }
      })
      .catch((err) => {
        console.warn('Could not load timeline events:', err);
        if (isMounted) {
          // If no events fetched, synthesize fallback stage steps from order metadata
          setTimelineEvents([]);
          setIsLoadingTimeline(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentOrder]);

  const handleRunFailureDetection = async () => {
    if (!currentOrder) return;
    try {
      setIsDetecting(true);
      const res = await detectOrderFailure(currentOrder.orderNumber || currentOrder._id);
      setDetectionResult(res);
      alert(res.incidentDetected ? `Failure Detected: ${res.incident?.failureCategory || 'Anomaly'}` : 'All stages healthy! No failure detected.');
    } catch (err) {
      alert('Failure detection error: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsDetecting(false);
    }
  };

  // Standard 6 broadband stages
  const STAGES = [
    { key: 'CRM', name: 'CRM Validation', service: 'crm-service', icon: User },
    { key: 'OMS', name: 'Order Management', service: 'oms-orchestrator', icon: Workflow },
    { key: 'INVENTORY', name: 'Port & ONT Allocation', service: 'inventory-system', icon: Layers },
    { key: 'PAYMENT', name: 'Payment Gateway', service: 'billing-adapter', icon: DollarSign },
    { key: 'PROVISIONING', name: 'Fiber Provisioning', service: 'olt-provisioner', icon: Wifi },
    { key: 'NOTIFICATION', name: 'SMS / Email Dispatch', service: 'notify-service', icon: Server }
  ];

  if (!currentOrder) {
    return (
      <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400">
        <Workflow className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-700">No Order Selected</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Please select an order from the Order Monitoring tab or simulate a new broadband order.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card: Order Selector & Quick Meta */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Active Order</span>
            <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-cyan-100 text-cyan-800">
              {currentOrder.orderNumber}
            </span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                currentOrder.overallStatus === 'COMPLETED'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : currentOrder.overallStatus === 'FAILED'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : currentOrder.overallStatus === 'DELAYED'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-purple-50 text-purple-700 border-purple-200'
              }`}
            >
              {currentOrder.overallStatus}
            </span>
          </div>
          <div className="text-xs text-slate-500 font-mono mt-1">
            Correlation ID: <span className="text-slate-700 font-semibold">{currentOrder.correlationId}</span>
          </div>
        </div>

        {/* Action Buttons & Order Dropdown Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={currentOrder.orderNumber}
            onChange={(e) => {
              const found = orders.find((o) => o.orderNumber === e.target.value);
              if (found) {
                setCurrentOrder(found);
                if (onSelectOrder) onSelectOrder(found);
              }
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            {orders.map((o) => (
              <option key={o.orderNumber} value={o.orderNumber}>
                {o.orderNumber} ({o.customer?.name || 'Customer'} - {o.overallStatus})
              </option>
            ))}
          </select>

          <button
            onClick={handleRunFailureDetection}
            disabled={isDetecting}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>{isDetecting ? 'Analyzing...' : 'Run Failure Detection'}</span>
          </button>

          <button
            onClick={() => {
              if (onSelectOrder) onSelectOrder(currentOrder);
              onNavigateTab('twin');
            }}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Digital Twin What-If</span>
          </button>
        </div>
      </div>

      {/* Customer & Telecom Specifications Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="text-[11px] font-semibold text-slate-400 uppercase">Customer Profile</div>
          <div className="text-sm font-bold text-slate-800 mt-1">{currentOrder.customer?.name || 'Synthetic Customer'}</div>
          <div className="text-xs text-slate-500 mt-0.5">{currentOrder.customer?.email || 'user@example.com'}</div>
          <div className="text-xs text-slate-400 mt-0.5">{currentOrder.customer?.address || '104 Highland Park, Node 4B'}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="text-[11px] font-semibold text-slate-400 uppercase">Broadband Plan</div>
          <div className="text-sm font-bold text-slate-800 mt-1">{currentOrder.product?.planName || 'Fiber 300 Mbps'}</div>
          <div className="text-xs text-slate-500 mt-0.5">Speed: {currentOrder.product?.speedMbps || 300} Mbps Up/Down</div>
          <div className="text-xs text-slate-400 mt-0.5">Price: ${currentOrder.product?.priceMonthly || 49.99}/mo</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="text-[11px] font-semibold text-slate-400 uppercase">Pipeline SLA Specs</div>
          <div className="text-sm font-bold text-slate-800 mt-1">{currentOrder.expectedSlaMs || 3500} ms Max SLA</div>
          <div className="text-xs text-slate-500 mt-0.5">
            Actual: <span className="font-semibold text-slate-700">{currentOrder.actualProcessingTimeMs || 0} ms</span>
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            Variance: {(currentOrder.actualProcessingTimeMs || 0) > (currentOrder.expectedSlaMs || 3500) ? '+Breached' : 'Within SLA'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="text-[11px] font-semibold text-slate-400 uppercase">Simulation Scenario</div>
          <div className="text-sm font-bold text-slate-800 mt-1">{currentOrder.scenario || 'STANDARD'}</div>
          <div className="text-xs text-slate-500 mt-0.5">Current Stage: {currentOrder.currentStage}</div>
          <div className="text-xs text-slate-400 mt-0.5">
            Created: {new Date(currentOrder.createdAt || Date.now()).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* 6-Stage Broadband Order Journey Timeline */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Workflow className="w-4 h-4 text-cyan-600" />
              6-Stage Telecom Broadband Journey Timeline
            </h3>
            <p className="text-xs text-slate-500">
              End-to-end execution path through CRM, OMS, Inventory, Payment, Provisioning, and Notification
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded">
            {timelineEvents.length} Recorded Stage Events
          </span>
        </div>

        {/* Visual Timeline Steps */}
        <div className="space-y-4">
          {STAGES.map((stg, index) => {
            // Find event matching this stage
            const matchingEvent = timelineEvents.find(
              (ev) => ev.stage?.toUpperCase() === stg.key || ev.metadata?.stage?.toUpperCase() === stg.key
            );

            // Determine status for this stage
            let isPassed = false;
            let isFailed = false;
            let isCurrent = currentOrder.currentStage === stg.key;
            let duration = matchingEvent?.durationMs || (isCurrent ? 250 : 180 + index * 40);
            let httpStatus = matchingEvent?.httpStatus || (isPassed ? 200 : 200);

            if (matchingEvent) {
              httpStatus = matchingEvent.httpStatus || 200;
              isFailed = matchingEvent.status === 'FAILED' || httpStatus >= 400;
              isPassed = matchingEvent.status === 'COMPLETED' || httpStatus === 200;
            } else {
              // Derive status based on currentStage
              const stageIdx = STAGES.findIndex((s) => s.key === currentOrder.currentStage);
              if (index < stageIdx) {
                isPassed = true;
                httpStatus = 200;
              } else if (index === stageIdx) {
                if (currentOrder.overallStatus === 'FAILED' || currentOrder.overallStatus === 'REJECTED') {
                  isFailed = true;
                  httpStatus = currentOrder.overallStatus === 'REJECTED' ? 422 : 504;
                } else {
                  isCurrent = true;
                  httpStatus = 200;
                }
              }
            }

            return (
              <div
                key={stg.key}
                className={`p-4 rounded-xl border transition-all ${
                  isFailed
                    ? 'border-rose-300 bg-rose-50/50 shadow-xs'
                    : isPassed
                    ? 'border-emerald-200 bg-emerald-50/30'
                    : isCurrent
                    ? 'border-cyan-300 bg-cyan-50/40 shadow-xs'
                    : 'border-slate-200 bg-slate-50/40 opacity-70'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  {/* Left: Stage Icon & Label */}
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${
                        isFailed
                          ? 'bg-rose-600 text-white shadow-sm shadow-rose-300'
                          : isPassed
                          ? 'bg-emerald-600 text-white'
                          : isCurrent
                          ? 'bg-cyan-600 text-white animate-pulse'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {index + 1}
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-800 text-xs">{stg.name}</span>
                        <span className="text-[10px] font-mono text-slate-400">({stg.service})</span>
                        {isFailed && (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
                            FAILED
                          </span>
                        )}
                        {isPassed && (
                          <span className="text-[10px] font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                            SUCCESS
                          </span>
                        )}
                        {isCurrent && !isFailed && (
                          <span className="text-[10px] font-medium text-cyan-700 bg-cyan-100 px-2 py-0.5 rounded">
                            PROCESSING
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {matchingEvent?.timestamp
                          ? new Date(matchingEvent.timestamp).toLocaleTimeString()
                          : `Stage Step #${index + 1}`}
                      </div>
                    </div>
                  </div>

                  {/* Right: Telemetry & HTTP Status Code */}
                  <div className="flex items-center space-x-4 text-xs">
                    <div className="text-right">
                      <span className="text-slate-400 text-[10px] block">Latency</span>
                      <span className="font-mono font-semibold text-slate-700">{duration} ms</span>
                    </div>

                    <div className="text-right">
                      <span className="text-slate-400 text-[10px] block">HTTP Response</span>
                      <span
                        className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                          httpStatus >= 500
                            ? 'bg-rose-100 text-rose-800'
                            : httpStatus >= 400
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        HTTP {httpStatus}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stage Payload / Metadata Sub-card */}
                <div className="mt-3 pt-3 border-t border-slate-200/60 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] font-mono text-slate-600 bg-white/60 p-2.5 rounded-lg">
                  {stg.key === 'CRM' && (
                    <>
                      <div>Account ID: <span className="font-bold text-slate-800">CUST-88219</span></div>
                      <div>Credit Status: <span className="text-emerald-700 font-bold">APPROVED</span></div>
                      <div>Kyc Verified: <span className="text-slate-800">TRUE</span></div>
                      <div>Contact Method: <span className="text-slate-800">EMAIL+SMS</span></div>
                    </>
                  )}
                  {stg.key === 'OMS' && (
                    <>
                      <div>Workflow ID: <span className="font-bold text-slate-800">WF-BROADBAND-01</span></div>
                      <div>Routing Engine: <span className="text-slate-800">BPMN-ACTIVE</span></div>
                      <div>Idempotency Key: <span className="text-slate-800">{currentOrder.orderNumber}-IDEMP</span></div>
                      <div>Priority: <span className="text-cyan-700 font-bold">STANDARD_FIBER</span></div>
                    </>
                  )}
                  {stg.key === 'INVENTORY' && (
                    <>
                      <div>ONT Serial: <span className="font-bold text-slate-800">ONT-HW-8271</span></div>
                      <div>PON Port: <span className="text-slate-800">PON-04/OLT-SOUTH</span></div>
                      <div>Splitter Ratio: <span className="text-slate-800">1:32 GPON</span></div>
                      <div>Port State: <span className="text-emerald-700 font-bold">RESERVED</span></div>
                    </>
                  )}
                  {stg.key === 'PAYMENT' && (
                    <>
                      <div>Gateway: <span className="font-bold text-slate-800">Stripe/TelecomBilling</span></div>
                      <div>Pre-Auth Ref: <span className="text-slate-800">TXN-9981-AUTH</span></div>
                      <div>Currency: <span className="text-slate-800">USD $49.99</span></div>
                      <div>Card Status: <span className="text-emerald-700 font-bold">SETTLED</span></div>
                    </>
                  )}
                  {stg.key === 'PROVISIONING' && (
                    <>
                      <div>OLT Cluster: <span className="font-bold text-slate-800">OLT-PRIMARY-BAY</span></div>
                      <div>IP Subnet: <span className="text-slate-800">100.64.12.84/30</span></div>
                      <div>VLAN ID: <span className="text-slate-800">VLAN-402</span></div>
                      <div>Radius Profile: <span className={isFailed ? 'text-rose-600 font-bold' : 'text-emerald-700 font-bold'}>{isFailed ? 'GATEWAY_TIMEOUT' : 'ACTIVE_300M'}</span></div>
                    </>
                  )}
                  {stg.key === 'NOTIFICATION' && (
                    <>
                      <div>Channel: <span className="font-bold text-slate-800">SMS Gateway + SES</span></div>
                      <div>Message Type: <span className="text-slate-800">ACTIVATION_CONFIRMED</span></div>
                      <div>Delivery Status: <span className="text-emerald-700 font-bold">SENT</span></div>
                      <div>Callback: <span className="text-slate-800">ACK_RECEIVED</span></div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
