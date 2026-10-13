import React from 'react';
import { SolarArray } from './equipment/SolarArray';
import { MainHabitat } from './equipment/MainHabitat';
import { BatteryBank } from './equipment/BatteryBank';
import { WaterStorage } from './equipment/WaterStorage';
import { WaterRecycling } from './equipment/WaterRecycling';
import { OxygenGeneration } from './equipment/OxygenGeneration';
import { SolidWasteUnit } from './equipment/SolidWasteUnit';
import { NuclearPowerUnit } from './equipment/NuclearPowerUnit';
import { PowerDistribution } from './equipment/PowerDistribution';
import { LunarLander } from './equipment/LunarLander';
import { LunarRover } from './equipment/LunarRover';
import { RFCPowerUnit } from './equipment/RFCPowerUnit';

export const HabitatComplex: React.FC = () => {
  return (
    <group>
      {/* 1. Primary Photovoltaic Array & Field */}
      <SolarArray id="solar-array-alpha" />

      {/* 2. Main Habitat and Crew Modules */}
      <MainHabitat id="main-habitat-core" />

      {/* 3. BESS Energy Storage Bank */}
      <BatteryBank id="battery-bank-bess" />

      {/* 4. Potable Water Storage Tanks */}
      <WaterStorage id="potable-water-tank" />

      {/* 5. Water Recovery and Recycling Unit (VCD) */}
      <WaterRecycling id="water-recycling-vcd" />

      {/* 6. Oxygen Generation and Life-Support Unit */}
      <OxygenGeneration id="oxygen-gen-eclss" />

      {/* 7. Solid-Waste Pyrolysis & Resource Unit */}
      <SolidWasteUnit id="solid-waste-pyro" />

      {/* 8. Backup Nuclear Kilopower Microreactor */}
      <NuclearPowerUnit id="nuclear-kilopower" />

      {/* 9. Microgrid Power Distribution Substation */}
      <PowerDistribution id="power-distribution-hub" />

      {/* 10. Autonomous Lunar Lander on Landing Pad */}
      <LunarLander id="lunar-lander-alpha" />

      {/* 11. Pressurized Lunar Exploration Rover */}
      <LunarRover id="lunar-rover-unit" />

      {/* 12. Regenerative Fuel Cell (RFC) Power Unit */}
      <RFCPowerUnit id="rfc-power-unit" />
    </group>
  );
};
