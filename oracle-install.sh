# Unpack Oracle Instant Client "Basic Lite"
mkdir /tmp/oracle
sudo unzip instantclient-basiclite-linux.x64-19.8.0.0.0dbru.zip -d /tmp/oracle
export INSTANT_CLIENT_DIR=/tmp/oracle/instantclient_19_8

# now copy all of the files from the instant client that we need
cd ./oracle-instant-client
cp -f $INSTANT_CLIENT_DIR/libclntshcore.so.19.1 lib/
cp -f $INSTANT_CLIENT_DIR/libclntsh.so lib/
cp -f $INSTANT_CLIENT_DIR/libclntsh.so.19.1 lib/
cp -f $INSTANT_CLIENT_DIR/libocci.so.19.1 lib/libocci.so
cp -f $INSTANT_CLIENT_DIR/libmql1.so lib/
cp -f $INSTANT_CLIENT_DIR/libipc1.so lib/
cp -f $INSTANT_CLIENT_DIR/libnnz19.so lib/
cp -f $INSTANT_CLIENT_DIR/libociicus.so lib/

# cleanup
sudo rm -R $INSTANT_CLIENT_DIR
