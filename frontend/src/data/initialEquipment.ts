import { EquipmentItem } from '../types/equipment';

export const INITIAL_EQUIPMENT_DATA: EquipmentItem[] = [
  {
    id: 'solar-array-alpha',
    code: 'PV-TRK-01',
    name: 'Dual-Axis Solar Photovoltaic Array',
    type: 'solar_array',
    category: 'energy_generation',
    status: 'nominal',
    criticality: 'mission_critical',
    position: [-65, 0, -55],
    rotation: [0, 0.4, 0],
    description: 'High-efficiency multi-junction GaAs solar array with dual-axis elevation tracking mounted on lunar regolith stanchions.',
    functionSummary: 'Primary daytime electrical energy generator. Tracks the low-angle lunar sun to maximize photon capture.',
    powerKW: 120.0,
    maxPowerKW: 140.0,
    temperatureK: 365,
    efficiencyPct: 32.4,
    healthPct: 98.5,
    customState: {
      trackingMode: 'auto',
      dustCleanCycles: 14,
      lastActionMessage: 'Active solar tracking aligned with low-angle polar sun'
    },
    metrics: {
      irradiance: { label: 'Solar Flux', value: 1361, unit: 'W/m²', min: 0, max: 1400, status: 'nominal' },
      trackingAngle: { label: 'Elevation Angle', value: 14.8, unit: 'deg', min: 0, max: 90, status: 'nominal' },
      dcVoltage: { label: 'Bus DC Voltage', value: 380.2, unit: 'V', min: 350, max: 420, status: 'nominal' },
      dustAccumulation: { label: 'Regolith Dust Occlusion', value: 1.8, unit: '%', min: 0, max: 100, status: 'nominal' },
      activeStrings: { label: 'Active PV Strings', value: '48 / 48', unit: 'strings', status: 'nominal' }
    }
  },
  {
    id: 'main-habitat-core',
    code: 'HAB-CORE-ALPHA',
    name: 'Command & Crew Geodesic Habitat',
    type: 'main_habitat',
    category: 'command_crew',
    status: 'nominal',
    criticality: 'life_critical',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    description: 'Pressurized multi-level habitat dome shielded with sintered regolith tiles, housing astronauts, avionics, and flight telemetry.',
    functionSummary: 'Astronaut living quarters, mission command bridge, crew hygiene, and communications gateway.',
    powerKW: -22.5,
    maxPowerKW: 30.0,
    temperatureK: 295.15, // 22 deg C
    efficiencyPct: 99.1,
    healthPct: 100.0,
    customState: {
      airlockSealed: true,
      lastActionMessage: 'Pressurized environment secure. Atmosphere composition 78% N2, 21% O2.'
    },
    metrics: {
      cabinPressure: { label: 'Cabin Pressure', value: 101.3, unit: 'kPa', min: 95, max: 103, status: 'nominal' },
      cabinTempC: { label: 'Internal Temp', value: 21.8, unit: '°C', min: 18, max: 24, status: 'nominal' },
      crewOccupancy: { label: 'Crew Compliment', value: '4 Astronauts', unit: 'pax', status: 'nominal' },
      co2Level: { label: 'CO2 Partial Pressure', value: 0.38, unit: 'kPa', min: 0, max: 0.8, status: 'nominal' },
      airlockCycles: { label: 'Airlock Status', value: 'Sealed (Nominal)', unit: '', status: 'nominal' }
    }
  },
  {
    id: 'battery-bank-bess',
    code: 'BESS-LUNAR-01',
    name: 'Modular BESS Energy Storage Bank',
    type: 'battery_bank',
    category: 'energy_storage',
    status: 'nominal',
    criticality: 'life_critical',
    position: [-32, 0, 22],
    rotation: [0, -0.2, 0],
    description: 'Vacuum-insulated cryogenic lithium iron phosphate & regenerative fuel cell energy storage rack container.',
    functionSummary: 'Buffers diurnal energy variations, absorbs peak solar surplus, and powers habitat during lunar night and eclipses.',
    powerKW: 28.5, // Currently charging
    maxPowerKW: 80.0,
    temperatureK: 293,
    efficiencyPct: 94.2,
    healthPct: 97.8,
    customState: {
      reserveLocked: false,
      lastActionMessage: 'Normal charge/discharge cycling enabled'
    },
    metrics: {
      stateOfCharge: { label: 'State of Charge (SoC)', value: 88.5, unit: '%', min: 20, max: 100, status: 'nominal' },
      storedCapacity: { label: 'Available Energy', value: 442.5, unit: 'kWh', min: 100, max: 500, status: 'nominal' },
      cellTemp: { label: 'Thermal Loop Temp', value: 20.4, unit: '°C', min: 10, max: 35, status: 'nominal' },
      cycleCount: { label: 'Battery Cycle Count', value: 142, unit: 'cycles', status: 'nominal' },
      maxDischargeRate: { label: 'Max Discharge C-Rate', value: '0.8 C', unit: '', status: 'nominal' }
    }
  },
  {
    id: 'potable-water-tank',
    code: 'H2O-TANK-SYS',
    name: 'Potable Water Storage Reservoir',
    type: 'potable_water',
    category: 'resource_recovery',
    status: 'nominal',
    criticality: 'life_critical',
    position: [28, 0, -24],
    rotation: [0, 0.6, 0],
    description: 'High-pressure vacuum-jacketed spherical fluid storage sphere with thermal heating elements and UV sterilization loops.',
    functionSummary: 'Stores potable drinking water, hydration fluid for crew, and reserve coolant for critical ECLSS radiators.',
    powerKW: -1.2,
    maxPowerKW: 3.5,
    temperatureK: 281, // ~8 deg C
    efficiencyPct: 99.8,
    healthPct: 99.0,
    customState: {
      sterilizationActive: true,
      lastActionMessage: 'Active UV recirculation loop operating nominal'
    },
    metrics: {
      waterVolume: { label: 'Total Potable Stock', value: 2680, unit: 'Liters', min: 500, max: 3000, status: 'nominal' },
      capacityPct: { label: 'Fill Ratio', value: 89.3, unit: '%', min: 20, max: 100, status: 'nominal' },
      tankPressure: { label: 'Tank Head Pressure', value: 245, unit: 'kPa', min: 200, max: 300, status: 'nominal' },
      sterilityPurity: { label: 'Purity Standard', value: 99.99, unit: '% H2O', min: 99.5, max: 100, status: 'nominal' },
      dailyConsumption: { label: 'Crew Consumption Rate', value: 10.4, unit: 'L/day', status: 'nominal' }
    }
  },
  {
    id: 'water-recycling-vcd',
    code: 'ECLSS-VCD-01',
    name: 'VCD Water Recovery & Recycling Unit',
    type: 'water_recycling',
    category: 'life_support',
    status: 'nominal',
    criticality: 'mission_critical',
    position: [38, 0, 10],
    rotation: [0, -0.3, 0],
    description: 'Vapor Compression Distillation (VCD) and catalytic post-treatment unit converting urine, wash water, and humidity into sterile water.',
    functionSummary: 'Closed-loop fluid reclamation system achieving >98% water loop closure on lunar surface.',
    powerKW: -7.5,
    maxPowerKW: 12.0,
    temperatureK: 338,
    efficiencyPct: 98.4,
    healthPct: 96.2,
    customState: {
      vcdActive: true,
      lastActionMessage: 'Centrifuge vacuum distillation loop processing active wastewater'
    },
    metrics: {
      recoveryRate: { label: 'Distillate Recovery Rate', value: 98.4, unit: '%', min: 90, max: 100, status: 'nominal' },
      processingThroughput: { label: 'Throughput', value: 3.2, unit: 'L/hr', min: 0, max: 5, status: 'nominal' },
      centrifugeRPM: { label: 'Centrifuge Drum Speed', value: 1450, unit: 'RPM', min: 1200, max: 1600, status: 'nominal' },
      condenserPressure: { label: 'Condenser Vacuum', value: 6.8, unit: 'kPa', min: 5, max: 10, status: 'nominal' },
      filterBedLife: { label: 'Catalytic Sorbent Bed', value: 84.1, unit: '% life', status: 'nominal' }
    }
  },
  {
    id: 'oxygen-gen-eclss',
    code: 'O2-SPE-GEN',
    name: 'Electrolysis & O2 Revitalisation Unit',
    type: 'oxygen_generation',
    category: 'life_support',
    status: 'nominal',
    criticality: 'life_critical',
    position: [18, 0, 32],
    rotation: [0, -0.5, 0],
    description: 'Solid Polymer Electrolyte (SPE) water electrolysis system coupled with Sabatier carbon dioxide reduction and cryocooler loop.',
    functionSummary: 'Generates breathing oxygen for the habitat cabin and astronaut extravehicular activity (EVA) suits.',
    powerKW: -14.2,
    maxPowerKW: 20.0,
    temperatureK: 320,
    efficiencyPct: 95.8,
    healthPct: 98.1,
    customState: {
      lastActionMessage: 'Electrolyzer cell stack generating 4.8 kg/day O2'
    },
    metrics: {
      o2GenRate: { label: 'O2 Generation Rate', value: 4.8, unit: 'kg/day', min: 3, max: 6, status: 'nominal' },
      o2Purity: { label: 'Oxygen Gas Purity', value: 99.98, unit: '%', min: 99.5, max: 100, status: 'nominal' },
      h2ByproductFlow: { label: 'H2 Byproduct Flow to Sabatier', value: 1.1, unit: 'kg/day', status: 'nominal' },
      electrolyzerCurrent: { label: 'Cell Stack Current', value: 42.5, unit: 'A', status: 'nominal' },
      cryoReserveO2: { label: 'Reserve Cryo Liquid O2', value: 240, unit: 'kg', min: 50, max: 300, status: 'nominal' }
    }
  },
  {
    id: 'solid-waste-pyro',
    code: 'SWP-PYRO-REC',
    name: 'Solid Waste Pyrolysis & Resource Unit',
    type: 'solid_waste_unit',
    category: 'resource_recovery',
    status: 'nominal',
    criticality: 'deferrable',
    position: [50, 0, 32],
    rotation: [0, 0.8, 0],
    description: 'High-temperature vacuum pyrolysis autoclave and compactor turning habitat packaging, plastic polymers, and biological waste into inert gases and 3D print feedstock.',
    functionSummary: 'Reduces habitat waste mass, sterilizes biologically active waste, and produces reusable manufacturing feedstock.',
    powerKW: -11.8,
    maxPowerKW: 18.0,
    temperatureK: 650,
    efficiencyPct: 91.2,
    healthPct: 94.0,
    customState: {
      pyroActive: true,
      lastActionMessage: 'Vacuum retort furnace operating batch cycle at 380°C'
    },
    metrics: {
      chamberTemp: { label: 'Pyrolysis Core Temp', value: 380, unit: '°C', min: 300, max: 550, status: 'nominal' },
      batchProgress: { label: 'Autoclave Batch Cycle', value: 64, unit: '%', min: 0, max: 100, status: 'nominal' },
      syngasRecovered: { label: 'Methane/Syngas Extracted', value: 1.45, unit: 'kg', status: 'nominal' },
      feedstockFilament: { label: 'Recovered Polymer Spool', value: 28.4, unit: 'kg', status: 'nominal' },
      ashReductionRatio: { label: 'Volume Reduction Ratio', value: '18 : 1', unit: '', status: 'nominal' }
    }
  },
  {
    id: 'nuclear-kilopower',
    code: 'FSP-KILO-01',
    name: 'Fission Surface Power (Kilopower)',
    type: 'nuclear_power',
    category: 'energy_generation',
    status: 'nominal',
    criticality: 'mission_critical',
    position: [-110, 0, 75],
    rotation: [0, 0, 0],
    description: 'NASA Kilopower-style compact 40 kWe uranium-235 solid block reactor with sodium heat pipes and Stirling engine heat-rejection umbrella.',
    functionSummary: 'Reliable, continuous baseload power supply positioned in an isolated berm outside crew radiation perimeter.',
    powerKW: 40.0,
    maxPowerKW: 40.0,
    temperatureK: 923, // 650 deg C core
    efficiencyPct: 35.0,
    healthPct: 99.9,
    customState: {
      nuclearOnline: true,
      lastActionMessage: 'Kilopower core nominal at 40 kWe continuous baseload'
    },
    metrics: {
      coreTempC: { label: 'Core Temp', value: 652, unit: '°C', min: 580, max: 750, status: 'nominal' },
      stirlingEngines: { label: 'Stirling Converters', value: '8 / 8 Online', unit: '', status: 'nominal' },
      radiationExclusionZone: { label: 'Perimeter Radiation', value: '< 0.05', unit: 'mSv/yr', status: 'nominal' },
      heatPipePressure: { label: 'Sodium Vapor Pressure', value: 1.12, unit: 'bar', status: 'nominal' },
      continuousRating: { label: 'Rated Baseload', value: 40.0, unit: 'kWe', status: 'nominal' }
    }
  },
  {
    id: 'power-distribution-hub',
    code: 'PDU-GRID-CENTRAL',
    name: 'Microgrid Power Distribution Substation',
    type: 'power_distribution',
    category: 'infrastructure',
    status: 'nominal',
    criticality: 'life_critical',
    position: [-20, 0, -18],
    rotation: [0, -0.4, 0],
    description: 'Central solid-state power conditioning and distribution unit with bidirectional DC-DC converters, dynamic bus switching, and autonomous fault breakers.',
    functionSummary: 'Directs power flow between solar array, nuclear reactor, battery bank, and habitat loads with nanosecond fault isolation.',
    powerKW: -1.6,
    maxPowerKW: 4.0,
    temperatureK: 288,
    efficiencyPct: 98.9,
    healthPct: 99.4,
    customState: {
      lastActionMessage: 'Bidirectional microgrid synchronizer locked at 380V DC'
    },
    metrics: {
      mainBusVoltage: { label: 'Primary HVDC Bus', value: 380.0, unit: 'V DC', min: 370, max: 390, status: 'nominal' },
      totalGridThroughput: { label: 'Grid Power Throughput', value: 160.0, unit: 'kW', status: 'nominal' },
      powerFactor: { label: 'Inverter Efficiency', value: 98.9, unit: '%', status: 'nominal' },
      activeFeeders: { label: 'Active Feeder Conduits', value: '9 / 9 Online', unit: '', status: 'nominal' },
      switchgearTripCount: { label: 'Breaker Trips (24h)', value: 0, unit: 'events', status: 'nominal' }
    }
  },
  {
    id: 'lunar-lander-alpha',
    code: 'LANDER-DESCENT-01',
    name: 'Autonomous Cargo & Crew Lander',
    type: 'lunar_lander',
    category: 'infrastructure',
    status: 'nominal',
    criticality: 'mission_critical',
    position: [85, 0, -75],
    rotation: [0, 0.25, 0],
    description: 'Reusable lunar descent stage parked on designated blast-deflection landing pad with propellant transfer lines and cargo crane.',
    functionSummary: 'Primary transit vehicle for surface payload delivery, return sample storage, and emergency evacuation.',
    powerKW: -0.8,
    maxPowerKW: 2.5,
    temperatureK: 275,
    efficiencyPct: 99.5,
    healthPct: 99.2,
    customState: {
      lastActionMessage: 'Descent stage secured on landing pad. Avionics in surface standby.'
    },
    metrics: {
      padStatus: { label: 'Landing Pad Berth', value: 'Berth 1 (Active)', unit: '', status: 'nominal' },
      propellantMethane: { label: 'Cryo Methane Remaining', value: 1420, unit: 'kg', status: 'nominal' },
      propellantLOX: { label: 'Cryo LOX Remaining', value: 4260, unit: 'kg', status: 'nominal' },
      avionicsLink: { label: 'Telemetry Telecommand', value: 'Active RF Uplink', unit: '', status: 'nominal' },
      payloadHold: { label: 'Cargo Payload Unloaded', value: 100, unit: '%', status: 'nominal' }
    }
  },
  {
    id: 'lunar-rover-unit',
    code: 'ROVER-EXPLORER-01',
    name: 'Pressurized Lunar Exploration Rover',
    type: 'lunar_rover',
    category: 'infrastructure',
    status: 'nominal',
    criticality: 'mission_critical',
    position: [70, 0, 50],
    rotation: [0, -0.6, 0],
    description: 'Long-range electric lunar terrain vehicle with active suspension, robotic sampling arm, and high-gain navigation mast.',
    functionSummary: 'Surface geology traverse vehicle capable of 40 km exploratory sorties into lunar craters and permanently shadowed regions.',
    powerKW: -2.0,
    maxPowerKW: 8.0,
    temperatureK: 286,
    efficiencyPct: 96.0,
    healthPct: 98.7,
    customState: {
      lastActionMessage: 'Parked at charging gantry. Battery charged to 94%.'
    },
    metrics: {
      batterySoC: { label: 'Rover Traction Battery', value: 94.2, unit: '%', min: 20, max: 100, status: 'nominal' },
      odometerKM: { label: 'Cumulative Traverse', value: 128.4, unit: 'km', status: 'nominal' },
      tirePressure: { label: 'Wire-Mesh Wheel State', value: 'Nominal Compliant', unit: '', status: 'nominal' },
      scienceArm: { label: 'Drill & Spectrometer Arm', value: 'Stowed (Ready)', unit: '', status: 'nominal' },
      navUplink: { label: 'Base Lidar & Comm Range', value: '64.8 m from HAB', unit: '', status: 'nominal' }
    }
  }
];
