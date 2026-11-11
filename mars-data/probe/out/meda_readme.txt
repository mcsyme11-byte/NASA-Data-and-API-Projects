Mars2020 Mars Environmental Dynamics Analyzer (MEDA)

Overview
========

The MEDA bundle contains several collections. 

data_raw_env:
  Raw data measurements taken by the instrument for all sensors
  except SkyCam.

data_partially_processed_env:
  Data from all sensors, except SkyCam, in an intermediate processing
  step between raw and calibrated data, with the purpose of
  facilitating engineering evaluation of the sensors’ health and
  trends.

data_calibrated_env:
  Data from all sensors except SkyCam after applying calibration
  equations. This is the minimum level that includes environmental physical
  magnitudes.

data_derived_env:
  Higher level data above calibrated data by making certain assumptions
  and models. Only some specific sensors have data at this level:
  Pressure Sensor, Humidity Sensor, certain TIRS channels and Wind Sensor.

The data_derived_env collection also has a second-by-second geometry
data set (ancillary data) relevant for the interpretation of the data,
such as the relative position of the sun, rover location and
orientation.

For most purposes, the recommended dataset to use for scientific
analysis is the derived level when available for a particular
sensor. Otherwise, the calibrated level should be used. However, if
the derived product exists but it has empty columns for a time range,
the data in those columns for that time interval are not considered
reliable for science use (and neither the calibrated level data should
be used).

The calibrated level should also be checked if inconsistencies are found
at the derived level. One example of this is data from the pressure sensor. 
Derived data is based on data from barocap 3 at the calibrated level. 
However, this barocap may have discontinuities under certain conditions. 
When this happens, barocap 2 should be checked. However, it should be taken 
into account that barocap 2 is noisier than barocap 3.

Data from some sensors prior to their first post-landing maintenance
activities are not considered reliable for scientific analysis and
should not be used. Those are:

- Humidity sensor data before sol 63.

- Wind sensor data before sol 36.

data_skycam:
  Images taken by SkyCam, both raw and higher level data
  products, such as images corrected radiometrically.

browse_skycam:
   SkyCam images in PNG format for a quick overview.

document:
   Various documents concerning MEDA data, including:
   
   - EDR SIS (specification of raw data format for all sensors except SkyCam)
   
   - RDR SIS (specification of calibrated data format for all sensors
     except SkyCam)
   
   - Bundle SIS (physical and logical structures and contents of the
     bundle)
   
   - Release Notes (text file containing the description of the
     details of of each release)

SkyCam specific documentation and calibration information are included
in this bundle as secondary members, meaning that they are physically
stored in another bundle which groups the information for all Mars2020
cameras. These are in the following collections:

document_camera:
  Mars 2020 cameras documentation (including SkyCam). This includes
  the Mars 2020 Cameras format specification

calibration_camera:
  Mars 2020 cameras calibration data (including SkyCam)

miscellaneous:
  Mars 20202 cameras miscellaneous data (such as Velocity templates)

The MEDA data files
===================

MEDA science data products are ASCII text comma-separated value (CSV)
tables except for SkyCam, which are two-dimensional binary image
arrays.

Each sensor is in a separate CSV text file. Each CSV file spans 1
martian sol (24 hr 39 min and 35.244 sec). Each SkyCam file contains a
single image.

CSV files may have empty columns depending on several conditions:

- A particular detector of a sensor is not available for the selected
  measurement mode.

- RDS sensor has two modes of operation (regular and high
  gain). Depending of which mode is used, the columns for the other
  mode are empty.

- Data may be only partially received on the ground.

- Some data in higher level data products could not be calculated. For
  some specific situations, this may be set to an invalid value
  (9999999999), for others the column remains empty.

All data files are accompanied by a ASCII PDS4 label (XML format). In
the case of CSV files, the XML labels have a description for each
column, magnitudes (when applicable) and data types. For SkyCam
images, the XML labels include various image description information,
such as exposition time, image type, camera temperature, or geometry
data.

The files follow a standard mission-wide naming convention described
in the SIS documents. Non-imaging sensors filenames begin with the
prefix "WE" and include the sol number, the data processing level and
the sensor name. SkyCam images filenames begin with the prefix "WS"
and have additional information such as the SCLK time at which they
were taken, downsampling and compression.

All files are versioned, so that if new data are available (either
newly raw data recovered on the ground or due to a correction in data
procession) a new version is generated. Only the file with the highest
version number should be used.

MEDA measurement strategy 
=========================

The MEDA data acquisition is based on a regular cadence, which may be
modified for some particular time ranges with the purpose to cover
specific events. Also, data gaps may exist due to anomalous conditions
or rover resource constraints.

At the time of this writing, the baseline strategy followed is to
measure 12 hours per sol at 1Hz all sensors, having even hours on
even-numbered sols and odd hours on odd-numbered sols. This allows
covering a full diurnal cycle every two sols, while keeping resources
within mission constraints.

Some observations have a specific measurement pattern for the Humidity
Sensor, called the High Resolution Interval Mode (HRIM). With this
pattern, the sensors repeats 10 sec long measurements every certain
fixed interval. This allows the sensor to cool down and gets better
data under certain conditions.

SkyCam images are taken at an average of 3-4 per sol depending on the
purpose and the sun location with respect to the rover. Most of them
fall into one of these categories: twilight images (taken either
before sunrise or after sunset), sky images (taken after sunrise and
before sunset) or tau (taken with Sun behind SkyCam's neutral density
annulus to get 'tau').
